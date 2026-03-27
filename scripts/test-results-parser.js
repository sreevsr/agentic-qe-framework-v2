#!/usr/bin/env node

/**
 * test-results-parser.js — Structured failure summary for the Executor agent
 *
 * DESIGN PRINCIPLE: This script is a context-saving optimization for the Executor.
 * It parses Playwright's JSON reporter output and produces a concise failure
 * summary. The Executor reads the summary (~10-20 lines) instead of parsing raw
 * terminal output (~30-80 lines per failure), saving context window space.
 *
 * - The script NEVER diagnoses root causes (that's LLM work)
 * - The script NEVER suggests fixes
 * - The script provides "category_hint" as a best-guess from error patterns —
 *   the Executor must verify before trusting it
 * - If the JSON file doesn't exist, the Executor falls back to terminal output
 *
 * Usage:
 *   node scripts/test-results-parser.js [--json-path=<path>] [--output-path=<path>]
 *
 * Defaults:
 *   --json-path=output/test-results/last-run.json
 *   --output-path=output/test-results/last-run-parsed.json
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------
const args = {};
process.argv.slice(2).forEach(arg => {
  const match = arg.match(/^--(\S+?)=(.+)$/);
  if (match) args[match[1]] = match[2];
});

const ROOT = path.resolve(__dirname, '..');
const OUTPUT = path.join(ROOT, 'output');

const jsonPath = args['json-path']
  ? path.resolve(args['json-path'])
  : path.join(OUTPUT, 'test-results', 'last-run.json');

const outputPath = args['output-path']
  ? path.resolve(args['output-path'])
  : path.join(OUTPUT, 'test-results', 'last-run-parsed.json');

// ---------------------------------------------------------------------------
// Error pattern → category hint mapping
//
// SOURCE OF TRUTH: agents/core/executor.md (Section 3.4: Diagnose)
// These patterns are a mechanical approximation of the failure types.
// The category_hint is a starting point for the LLM — not a final diagnosis.
//
// DRIFT DETECTION: In v2, the Executor's diagnosis rules live in agents/core/executor.md.
// The script hashes that file's diagnostic section. If it changes, the parser warns
// the Executor to classify from error messages directly.
//
// To update after reviewing category changes:
//   node scripts/test-results-parser.js --rehash-categories
// ---------------------------------------------------------------------------

const KNOWN_CATEGORIES_HASH = 'NOT_YET_HASHED';

function computeCategoryDrift() {
  const executorPath = path.join(ROOT, 'agents', 'core', 'executor.md');
  try {
    const content = fs.readFileSync(executorPath, 'utf-8');
    const match = content.match(/### 3\.4: Diagnose[\s\S]*?(?=\n---\n|\n## 4\.)/);
    if (!match) return { status: 'PARSE_ERROR', message: 'Could not find diagnose section in executor.md' };
    const currentHash = crypto.createHash('sha256').update(match[0].trim()).digest('hex').slice(0, 12);
    if (currentHash !== KNOWN_CATEGORIES_HASH) {
      return {
        status: 'MODIFIED',
        currentHash,
        knownHash: KNOWN_CATEGORIES_HASH,
        message: 'Executor diagnosis rules changed since hints were last updated. LLM should classify from error messages directly — do not trust category_hint values.',
      };
    }
    return null; // No drift
  } catch {
    return { status: 'FILE_NOT_FOUND', message: 'executor.md not found — category hints may be stale.' };
  }
}

// --rehash-categories mode
if (process.argv.includes('--rehash-categories')) {
  const executorPath = path.join(ROOT, 'agents', 'core', 'executor.md');
  const content = fs.readFileSync(executorPath, 'utf-8');
  const match = content.match(/### 3\.4: Diagnose[\s\S]*?(?=\n---\n|\n## 4\.)/);
  if (!match) { console.error('Could not find diagnose section in executor.md'); process.exit(1); }
  const hash = crypto.createHash('sha256').update(match[0].trim()).digest('hex').slice(0, 12);
  console.log(`// Updated KNOWN_CATEGORIES_HASH — paste into test-results-parser.js:`);
  console.log(`const KNOWN_CATEGORIES_HASH = '${hash}';`);
  process.exit(0);
}

const CATEGORY_PATTERNS = [
  { pattern: /Cannot find module|ERR_MODULE_NOT_FOUND/i, hint: 'A', label: 'Import/Module Error' },
  { pattern: /strict mode violation.*resolved to \d+ elements/i, hint: 'B', label: 'Strict Mode — multiple matches' },
  { pattern: /All selectors failed|Timeout waiting for selector|locator\.waitFor/i, hint: 'B', label: 'Locator Not Found / Timeout' },
  { pattern: /expect\(received\)\.toBe\(expected\)|expect\(received\)\.toContain|expect\(received\)\.toEqual/i, hint: 'C', label: 'Assertion Mismatch' },
  { pattern: /net::ERR_|Navigation timeout|page\.goto.*timeout/i, hint: 'D', label: 'Navigation/Network Error' },
  { pattern: /browserType\.launch|Executable doesn.t exist/i, hint: 'E', label: 'Browser/Config Error' },
  { pattern: /Cannot read properties of undefined|TypeError.*undefined/i, hint: 'F', label: 'Env Variable / Undefined' },
  { pattern: /response\.status\(\)|response\.ok\(\)|API.*\d{3}/i, hint: 'G', label: 'API Response Error' },
  { pattern: /Target page.*closed|browser has been closed|context has been closed/i, hint: 'D', label: 'Page/Context Closed' },
  { pattern: /waitForTimeout|PACING/i, hint: 'K', label: 'Pacing Issue' },
];

function classifyError(errorMessage) {
  for (const { pattern, hint, label } of CATEGORY_PATTERNS) {
    if (pattern.test(errorMessage)) {
      return { hint, label };
    }
  }
  return { hint: 'UNKNOWN', label: 'Unclassified — LLM must diagnose' };
}

/**
 * Extract the file:line from a stack trace.
 * Looks for the first line that references a file in output/ (not node_modules or playwright internals).
 */
function extractFileLocation(stack) {
  if (!stack) return null;
  const lines = stack.split('\n');
  for (const line of lines) {
    // Match patterns like "at Something (output/pages/FooPage.ts:42:15)"
    // or "output/tests/web/foo.spec.ts:100:5"
    const match = line.match(/(output\/\S+\.ts):(\d+):(\d+)/);
    if (match) {
      return { file: match[1], line: parseInt(match[2], 10), column: parseInt(match[3], 10) };
    }
  }
  return null;
}

/**
 * Find the deepest failing step in a step tree (recursive).
 * Playwright nests steps — we want the innermost step that has an error.
 */
function findFailingStep(steps, depth = 0) {
  if (!steps || steps.length === 0) return null;

  for (const step of steps) {
    // Check nested steps first (depth-first)
    if (step.steps && step.steps.length > 0) {
      const nested = findFailingStep(step.steps, depth + 1);
      if (nested) return nested;
    }
    // This step has an error
    if (step.error) {
      return {
        title: step.title,
        duration: step.duration,
        error: step.error,
        depth,
      };
    }
  }
  return null;
}

/**
 * Count passed and failed steps (top-level only — not nested sub-steps).
 */
function countSteps(steps) {
  if (!steps || steps.length === 0) return { passed: 0, failed: 0, total: 0 };

  let passed = 0;
  let failed = 0;
  const passedNames = [];

  for (const step of steps) {
    if (step.error) {
      failed++;
    } else {
      passed++;
      passedNames.push(step.title);
    }
  }

  return { passed, failed, total: steps.length, passedNames };
}

// ---------------------------------------------------------------------------
// Main parser
// ---------------------------------------------------------------------------
function main() {
  // Read the Playwright JSON report
  if (!fs.existsSync(jsonPath)) {
    console.error(`[test-results-parser] JSON file not found: ${jsonPath}`);
    console.error('[test-results-parser] Run tests with: PLAYWRIGHT_JSON_OUTPUT_NAME=test-results/last-run.json npx playwright test ... --reporter=list,json');
    process.exit(1);
  }

  let report;
  try {
    report = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
  } catch (e) {
    console.error(`[test-results-parser] Failed to parse JSON: ${e.message}`);
    process.exit(1);
  }

  // Extract stats
  const stats = report.stats || {};
  const summary = {
    total: (stats.expected || 0) + (stats.unexpected || 0) + (stats.skipped || 0) + (stats.flaky || 0),
    passed: stats.expected || 0,
    failed: stats.unexpected || 0,
    skipped: stats.skipped || 0,
    flaky: stats.flaky || 0,
    duration: Math.round(stats.duration || 0),
  };

  // Walk suites to find all test results
  const failures = [];
  const passes = [];

  function walkSuites(suites) {
    for (const suite of suites) {
      if (suite.specs) {
        for (const spec of suite.specs) {
          for (const test of spec.tests || []) {
            for (const result of test.results || []) {
              const testInfo = {
                testName: spec.title,
                file: suite.file || spec.file,
                tags: spec.tags || [],
                status: result.status,
                duration: result.duration,
              };

              if (result.status === 'passed') {
                const stepInfo = countSteps(result.steps);
                passes.push({
                  ...testInfo,
                  stepCount: stepInfo.total,
                });
              } else if (result.status === 'failed' || result.status === 'timedOut') {
                // Find the failing step
                const failingStep = findFailingStep(result.steps);
                const stepInfo = countSteps(result.steps);

                // Extract error details
                const errorDetails = result.errors?.[0] || failingStep?.error || {};
                const errorMessage = errorDetails.message || 'No error message captured';
                const errorStack = errorDetails.stack || errorDetails.snippet || '';

                // Classify the error
                const classification = classifyError(errorMessage);
                const fileLocation = extractFileLocation(errorStack);

                failures.push({
                  ...testInfo,
                  failedStep: failingStep?.title || 'Unknown step',
                  failedStepNumber: extractStepNumber(failingStep?.title),
                  error: {
                    message: truncate(errorMessage, 500),
                    category_hint: classification.hint,
                    category_label: classification.label,
                    file: fileLocation?.file || null,
                    line: fileLocation?.line || null,
                  },
                  passedStepCount: stepInfo.passed,
                  failedStepCount: stepInfo.failed,
                  totalStepCount: stepInfo.total,
                  passedSteps: stepInfo.passedNames.slice(0, 10), // cap at 10 to save space
                });
              }
            }
          }
        }
      }
      if (suite.suites) {
        walkSuites(suite.suites);
      }
    }
  }

  walkSuites(report.suites || []);

  // Check category drift
  const categoryDrift = computeCategoryDrift();

  // Build the parsed output
  const parsed = {
    version: '1.0',
    parsedAt: new Date().toISOString(),
    jsonSource: path.relative(ROOT, jsonPath),
    summary,
    allPassing: summary.failed === 0 && summary.total > 0,
    categoryDrift: categoryDrift || null,
    failures,
    passes: passes.map(p => ({ testName: p.testName, duration: p.duration, stepCount: p.stepCount })),
  };

  // Write output
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  fs.writeFileSync(outputPath, JSON.stringify(parsed, null, 2));

  // Print summary
  if (categoryDrift) {
    console.warn(`[test-results-parser] WARNING: ${categoryDrift.message}`);
  }
  const icon = parsed.allPassing ? '✓' : '✗';
  console.log(`[test-results-parser] ${icon} ${summary.passed}/${summary.total} passed | ${summary.failed} failed | ${summary.duration}ms`);
  if (failures.length > 0) {
    for (const f of failures) {
      console.log(`  FAIL: ${f.testName} → Step: ${f.failedStep}`);
      console.log(`        Error: ${f.error.message.slice(0, 120)}`);
      console.log(`        Hint: Category ${f.error.category_hint} (${f.error.category_label})`);
      if (f.error.file) console.log(`        File: ${f.error.file}:${f.error.line}`);
    }
  }
  console.log(`[test-results-parser] Parsed output saved to ${path.relative(ROOT, outputPath)}`);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function extractStepNumber(stepTitle) {
  if (!stepTitle) return null;
  const match = stepTitle.match(/Step\s+(\d+(?:\.\d+)?)/i);
  return match ? match[1] : null;
}

function truncate(str, maxLen) {
  if (!str || str.length <= maxLen) return str;
  return str.slice(0, maxLen) + '... [truncated]';
}

main();
