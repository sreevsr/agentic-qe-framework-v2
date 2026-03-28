#!/usr/bin/env node

/**
 * explorer-post-check.js — Mechanical verification of Explorer-Builder output
 *
 * This script runs AFTER the Explorer-Builder completes (all chunks) and BEFORE
 * the Executor starts. It provides deterministic, non-fabricatable evidence about
 * what was actually produced.
 *
 * DESIGN PRINCIPLE: Scripts for evidence, LLMs for judgment. This script counts
 * files, elements, and keywords mechanically. It does NOT judge quality — that's
 * the Reviewer's job. It provides ground truth that cannot be fabricated.
 *
 * Usage:
 *   node scripts/explorer-post-check.js --scenario=<name> --type=<web|api|hybrid> [--folder=<folder>]
 *
 * Output:
 *   JSON to stdout (Orchestrator reads this directly)
 */

const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------
const args = {};
process.argv.slice(2).forEach(arg => {
  const match = arg.match(/^--(\w+)=(.+)$/);
  if (match) args[match[1]] = match[2];
});

const scenario = args.scenario;
const type = args.type || 'web';
const folder = args.folder || null;

if (!scenario) {
  console.error('Usage: node scripts/explorer-post-check.js --scenario=<name> --type=<web|api|hybrid> [--folder=<folder>]');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Path resolution
// ---------------------------------------------------------------------------
const projectRoot = path.resolve(__dirname, '..');
const outputDir = path.join(projectRoot, 'output');
const folderPrefix = folder ? path.join(folder) : '';

const paths = {
  scenarioFile: path.join(projectRoot, 'scenarios', type, folderPrefix, `${scenario}.md`),
  enrichedFile: path.join(projectRoot, 'scenarios', type, folderPrefix, `${scenario}.enriched.md`),
  specFile: path.join(outputDir, 'tests', type, folderPrefix, `${scenario}.spec.ts`),
  specFileJs: path.join(outputDir, 'tests', type, folderPrefix, `${scenario}.spec.js`),
  testDataFile: path.join(outputDir, 'test-data', type, `${scenario}.json`),
  locatorsDir: path.join(outputDir, 'locators'),
  pagesDir: path.join(outputDir, 'pages'),
  explorerReport: path.join(outputDir, 'reports', folderPrefix, `explorer-report-${scenario}.md`),
  explorerMetrics: path.join(outputDir, 'reports', 'metrics', `explorer-metrics-${scenario}.json`),
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function fileExists(p) {
  return fs.existsSync(p);
}

function readFile(p) {
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf-8') : null;
}

function countPattern(content, regex) {
  const matches = content.match(regex);
  return matches ? matches.length : 0;
}

function listJsonFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(f => f.endsWith('.locators.json'));
}

function listPageFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(f => f.endsWith('Page.ts') || f.endsWith('Page.js'));
}

// ---------------------------------------------------------------------------
// 1. File existence checks
// ---------------------------------------------------------------------------
const specPath = fileExists(paths.specFile) ? paths.specFile : (fileExists(paths.specFileJs) ? paths.specFileJs : null);
const specContent = specPath ? readFile(specPath) : null;
const scenarioContent = readFile(paths.scenarioFile);
const enrichedContent = readFile(paths.enrichedFile);

const fileChecks = {
  scenarioExists: fileExists(paths.scenarioFile),
  enrichedExists: fileExists(paths.enrichedFile),
  specExists: specPath !== null,
  testDataExists: fileExists(paths.testDataFile),
  explorerReportExists: fileExists(paths.explorerReport),
  explorerMetricsExists: fileExists(paths.explorerMetrics),
};

// ---------------------------------------------------------------------------
// 2. Locator file inventory — count elements mechanically
// ---------------------------------------------------------------------------
const locatorFiles = listJsonFiles(paths.locatorsDir);
let totalLocatorElements = 0;
const locatorInventory = [];

for (const file of locatorFiles) {
  const filePath = path.join(paths.locatorsDir, file);
  try {
    const json = JSON.parse(readFile(filePath));
    const elementCount = Object.keys(json).length;
    totalLocatorElements += elementCount;

    // Check fallbacks
    let missingFallbacks = 0;
    for (const [key, value] of Object.entries(json)) {
      if (!value.fallbacks || value.fallbacks.length < 2) {
        missingFallbacks++;
      }
    }

    locatorInventory.push({
      file,
      elements: elementCount,
      missingFallbacks,
    });
  } catch (e) {
    locatorInventory.push({ file, error: 'Invalid JSON' });
  }
}

// ---------------------------------------------------------------------------
// 3. Page object inventory
// ---------------------------------------------------------------------------
const pageFiles = listPageFiles(paths.pagesDir);

// ---------------------------------------------------------------------------
// 4. Scenario step count (mechanical — count numbered lines under ## Steps)
// ---------------------------------------------------------------------------
let scenarioStepCount = 0;
let scenarioKeywords = {
  VERIFY: 0,
  VERIFY_SOFT: 0,
  CAPTURE: 0,
  SCREENSHOT: 0,
  REPORT: 0,
  CALCULATE: 0,
  SAVE: 0,
};

if (scenarioContent) {
  // Find ## Steps section and count numbered lines
  const stepsMatch = scenarioContent.match(/## Steps[\s\S]*$/m);
  if (stepsMatch) {
    const stepsSection = stepsMatch[0];
    const numberedLines = stepsSection.match(/^\d+\./gm);
    scenarioStepCount = numberedLines ? numberedLines.length : 0;

    // Count keywords
    scenarioKeywords.VERIFY = countPattern(stepsSection, /\bVERIFY:/g) - countPattern(stepsSection, /\bVERIFY_SOFT:/g);
    scenarioKeywords.VERIFY_SOFT = countPattern(stepsSection, /\bVERIFY_SOFT:/g);
    scenarioKeywords.CAPTURE = countPattern(stepsSection, /\bCAPTURE:/g);
    scenarioKeywords.SCREENSHOT = countPattern(stepsSection, /\bSCREENSHOT:/g);
    scenarioKeywords.REPORT = countPattern(stepsSection, /\bREPORT:/g);
    scenarioKeywords.CALCULATE = countPattern(stepsSection, /\bCALCULATE:/g);
    scenarioKeywords.SAVE = countPattern(stepsSection, /\bSAVE:/g);
  }
}

// ---------------------------------------------------------------------------
// 5. Spec step count (mechanical — count test.step() calls)
// ---------------------------------------------------------------------------
let specStepCount = 0;
let specKeywords = {
  expect: 0,
  expectSoft: 0,
  screenshot: 0,
  annotationsPush: 0,
  attach: 0,
};

if (specContent) {
  // Count top-level test.step() calls (Step N pattern)
  specStepCount = countPattern(specContent, /await test\.step\([`'"]Step \d+/g);

  // Count keyword implementations
  specKeywords.expect = countPattern(specContent, /\bexpect\(/g);
  specKeywords.expectSoft = countPattern(specContent, /\bexpect\.soft\(/g);
  specKeywords.screenshot = countPattern(specContent, /page\.screenshot\(/g);
  specKeywords.annotationsPush = countPattern(specContent, /annotations\.push\(/g);
  specKeywords.attach = countPattern(specContent, /test\.info\(\)\.attach\(/g);
}

// ---------------------------------------------------------------------------
// 6. Fidelity check — do counts match?
// ---------------------------------------------------------------------------
const fidelity = {
  stepCountMatch: scenarioStepCount === specStepCount,
  scenarioSteps: scenarioStepCount,
  specSteps: specStepCount,
  delta: specStepCount - scenarioStepCount,
};

// ---------------------------------------------------------------------------
// 7. Raw selector audit (mechanical — find page.locator() not from loc.get())
// ---------------------------------------------------------------------------
let rawSelectorsInSpec = 0;
if (specContent) {
  // page.locator('...') calls that are NOT through a page object
  rawSelectorsInSpec = countPattern(specContent, /page\.locator\(/g);
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------
const result = {
  version: '1.0',
  scenario,
  type,
  folder: folder || null,
  timestamp: new Date().toISOString(),
  fileChecks,
  locators: {
    files: locatorInventory,
    totalFiles: locatorFiles.length,
    totalElements: totalLocatorElements,
  },
  pageObjects: {
    files: pageFiles,
    totalFiles: pageFiles.length,
  },
  scenarioCounts: {
    steps: scenarioStepCount,
    keywords: scenarioKeywords,
  },
  specCounts: {
    steps: specStepCount,
    keywords: specKeywords,
  },
  fidelity,
  rawSelectorsInSpec,
  warnings: [],
};

// Add warnings for issues
if (!fileChecks.enrichedExists) {
  result.warnings.push('MISSING: enriched.md file was not created');
}
if (!fileChecks.specExists) {
  result.warnings.push('CRITICAL: spec file does not exist');
}
if (!fidelity.stepCountMatch) {
  result.warnings.push(`MISMATCH: scenario has ${scenarioStepCount} steps but spec has ${specStepCount} test.step() calls (delta: ${fidelity.delta})`);
}
if (rawSelectorsInSpec > 0) {
  result.warnings.push(`RAW SELECTORS: ${rawSelectorsInSpec} page.locator() calls found in spec file`);
}
for (const loc of locatorInventory) {
  if (loc.missingFallbacks > 0) {
    result.warnings.push(`FALLBACKS: ${loc.file} has ${loc.missingFallbacks} elements with fewer than 2 fallbacks`);
  }
}

console.log(JSON.stringify(result, null, 2));
