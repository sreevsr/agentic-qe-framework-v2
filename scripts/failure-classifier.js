#!/usr/bin/env node

/**
 * failure-classifier.js — Classifies test failures for CI/CD decision-making
 *
 * Tier 1 of three-tier failure handling. Deterministic — no LLM, no tokens.
 *
 * Usage:
 *   node scripts/failure-classifier.js --results=output/test-results/last-run-parsed.json
 *   node scripts/failure-classifier.js --results=<file> --output=analysis.json --scenario=<name>
 *
 * Classifications: AUTO_RETRY, SELECTOR_ISSUE, LIKELY_REGRESSION, ENVIRONMENT_ISSUE, CODE_ERROR, NEEDS_TRIAGE
 *
 * Exit codes:
 *   0 — No regressions found (only AUTO_RETRY, SELECTOR_ISSUE, or ENVIRONMENT_ISSUE)
 *   1 — Regressions or triage-needed failures found
 *   2 — Usage error (missing arguments, file not found)
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const args = {};
process.argv.slice(2).forEach(arg => {
  const match = arg.match(/^--([\w-]+)=(.+)$/);
  if (match) args[match[1]] = match[2];
});

const resultsFile = args.results;
const scenarioFilter = args.scenario || null;
const outputFile = args.output || path.join(path.dirname(resultsFile || '.'), 'failure-analysis.json');

if (!resultsFile || !fs.existsSync(resultsFile)) {
  console.error('Usage: node scripts/failure-classifier.js --results=<parsed-results.json> [--scenario=<name>] [--output=<path>]');
  process.exit(2);
}

const results = JSON.parse(fs.readFileSync(resultsFile, 'utf-8'));

// Stability history — tracks per-test pass/fail rates across runs
const historyFile = path.join(path.dirname(resultsFile), 'test-stability-history.json');
let stabilityHistory = {};
if (fs.existsSync(historyFile)) {
  stabilityHistory = JSON.parse(fs.readFileSync(historyFile, 'utf-8'));
}

/**
 * Categorize error message into failure types
 */
function categorizeError(errorMsg) {
  const msg = errorMsg.toLowerCase();
  if (msg.includes('waiting for locator') || msg.includes('element not found') || msg.includes('no element matches')) return 'ELEMENT_NOT_FOUND';
  if (msg.includes('timeout') || msg.includes('exceeded') || msg.includes('timed out')) return 'TIMEOUT';
  if (msg.includes('expect(') || msg.includes('expected') || msg.includes('tobe(') || msg.includes('tocontain(') || msg.includes('tohaveurl')) return 'ASSERTION_FAILURE';
  if (msg.includes('navigation') || msg.includes('net::err') || msg.includes('page.goto')) return 'NAVIGATION_ERROR';
  if (msg.includes('econnrefused') || msg.includes('enotfound') || msg.includes('fetch failed')) return 'NETWORK_ERROR';
  if (msg.includes('syntaxerror') || msg.includes('typeerror') || msg.includes('referenceerror') || msg.includes('cannot find module')) return 'CODE_ERROR';
  return 'UNKNOWN';
}

/**
 * Classify a single test failure
 */
function classifyFailure(failure) {
  const testId = failure.testName || failure.title || 'unknown';
  const errorMsg = failure.error || failure.errorMessage || '';
  const errorType = categorizeError(errorMsg);

  // 1. Stability check — known flaky?
  const history = stabilityHistory[testId];
  if (history && (history.passes + history.failures) > 0) {
    const stabilityIndex = history.passes / (history.passes + history.failures);
    if (stabilityIndex > 0.95 && !failure.retriedAndFailed) {
      return { testId, action: 'AUTO_RETRY', confidence: 'high', reason: `Stability ${(stabilityIndex * 100).toFixed(1)}%`, errorType, errorMessage: errorMsg.substring(0, 1000) };
    }
  }

  // 2. Code/import error — mechanical fix possible
  if (errorType === 'CODE_ERROR') {
    return { testId, action: 'CODE_ERROR', confidence: 'high', reason: 'Syntax, type, or import error — mechanical fix possible', errorType, errorMessage: errorMsg.substring(0, 1000) };
  }

  // 3. Selector/locator issue
  if (errorType === 'ELEMENT_NOT_FOUND' || errorType === 'TIMEOUT') {
    return { testId, action: 'SELECTOR_ISSUE', confidence: 'medium', reason: 'Element not found or timeout — likely stale selector', errorType, errorMessage: errorMsg.substring(0, 1000) };
  }

  // 4. Assertion failure — likely regression
  if (errorType === 'ASSERTION_FAILURE') {
    return { testId, action: 'LIKELY_REGRESSION', confidence: 'medium', reason: 'Assertion failed — expected value does not match actual', errorType, errorMessage: errorMsg.substring(0, 1000) };
  }

  // 5. Navigation/network — environment issue
  if (errorType === 'NAVIGATION_ERROR' || errorType === 'NETWORK_ERROR') {
    return { testId, action: 'ENVIRONMENT_ISSUE', confidence: 'medium', reason: 'Navigation or network error — possible environment issue', errorType, errorMessage: errorMsg.substring(0, 1000) };
  }

  // 6. Default — needs triage
  return { testId, action: 'NEEDS_TRIAGE', confidence: 'low', reason: 'Cannot classify confidently — needs human review', errorType, errorMessage: errorMsg.substring(0, 1000) };
}

// Get all failures, optionally filter by scenario
let allFailures = results.failures || results.failed || [];
if (scenarioFilter) {
  allFailures = allFailures.filter(f => {
    const id = f.testName || f.title || '';
    return id.toLowerCase().includes(scenarioFilter.toLowerCase());
  });
}

const failures = allFailures.map(classifyFailure);

// Build summary
const summary = {
  timestamp: new Date().toISOString(),
  scenarioFilter: scenarioFilter || 'all',
  totalFailures: failures.length,
  classifications: {
    AUTO_RETRY: failures.filter(f => f.action === 'AUTO_RETRY').length,
    SELECTOR_ISSUE: failures.filter(f => f.action === 'SELECTOR_ISSUE').length,
    LIKELY_REGRESSION: failures.filter(f => f.action === 'LIKELY_REGRESSION').length,
    ENVIRONMENT_ISSUE: failures.filter(f => f.action === 'ENVIRONMENT_ISSUE').length,
    CODE_ERROR: failures.filter(f => f.action === 'CODE_ERROR').length,
    NEEDS_TRIAGE: failures.filter(f => f.action === 'NEEDS_TRIAGE').length,
  },
  failures,
};

// Write output
const outputDir = path.dirname(outputFile);
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(outputFile, JSON.stringify(summary, null, 2));

// Update stability history with this run's results
const allTests = results.tests || results.specs || [];
for (const test of allTests) {
  const testId = test.testName || test.title || test.name;
  if (!testId) continue;
  if (!stabilityHistory[testId]) stabilityHistory[testId] = { passes: 0, failures: 0, lastSeen: null };
  if (test.ok || test.status === 'passed') {
    stabilityHistory[testId].passes++;
  } else if (test.status === 'failed' || test.ok === false) {
    stabilityHistory[testId].failures++;
  }
  stabilityHistory[testId].lastSeen = new Date().toISOString();
}
fs.writeFileSync(historyFile, JSON.stringify(stabilityHistory, null, 2));

// Console output
console.log(`\nFailure Classification${scenarioFilter ? ` (scenario: ${scenarioFilter})` : ''}:`);
console.log(`  Total failures:     ${summary.totalFailures}`);
Object.entries(summary.classifications).forEach(([k, v]) => {
  if (v > 0) console.log(`  ${k}: ${v}`);
});
console.log(`Output: ${outputFile}`);
console.log(`Stability history updated: ${historyFile}`);

// Exit code — nonzero if regressions or triage-needed failures found
const hasRegressions = summary.classifications.LIKELY_REGRESSION > 0 || summary.classifications.NEEDS_TRIAGE > 0;
process.exit(hasRegressions ? 1 : 0);
