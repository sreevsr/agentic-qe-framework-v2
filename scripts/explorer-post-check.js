#!/usr/bin/env node

/**
 * explorer-post-check.js — Mechanical verification of Explorer/Builder output
 *
 * This script runs AFTER the Explorer/Builder completes (all chunks) and BEFORE
 * the Executor starts. It provides deterministic, non-fabricatable evidence about
 * what was actually produced.
 *
 * DESIGN PRINCIPLE: Scripts for evidence, LLMs for judgment. This script counts
 * files, elements, and keywords mechanically. It does NOT judge quality — that's
 * the Reviewer's job. It provides ground truth that cannot be fabricated.
 *
 * Usage:
 *   node scripts/explorer-post-check.js --scenario=<name> --type=<web|api|hybrid|mobile|mobile-hybrid> [--folder=<folder>]
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
  console.error('Usage: node scripts/explorer-post-check.js --scenario=<name> --type=<web|api|hybrid|mobile|mobile-hybrid> [--folder=<folder>]');
  process.exit(1);
}

const isMobile = type === 'mobile' || type === 'mobile-hybrid';

// ---------------------------------------------------------------------------
// Path resolution
// ---------------------------------------------------------------------------
const projectRoot = path.resolve(__dirname, '..');
const outputDir = path.join(projectRoot, 'output');
const folderPrefix = folder ? path.join(folder) : '';

// Mobile scenarios always live FLAT under scenarios/mobile/, regardless of variant.
// Mobile specs live under output/tests/mobile/{folder}/, the same folder convention as web.
// The web pipeline applies `folder` to BOTH scenario + spec paths; the mobile pipeline
// applies it ONLY to the spec path.
const scenarioTypeDir = isMobile ? 'mobile' : type;
const specTypeDir = isMobile ? 'mobile' : type;
const scenarioFolderPrefix = isMobile ? '' : folderPrefix;

const paths = {
  scenarioFile: path.join(projectRoot, 'scenarios', scenarioTypeDir, scenarioFolderPrefix, `${scenario}.md`),
  enrichedFile: path.join(projectRoot, 'scenarios', scenarioTypeDir, scenarioFolderPrefix, `${scenario}.enriched.md`),
  specFile: path.join(outputDir, 'tests', specTypeDir, folderPrefix, `${scenario}.spec.ts`),
  specFileJs: path.join(outputDir, 'tests', specTypeDir, folderPrefix, `${scenario}.spec.js`),
  testDataFile: path.join(outputDir, 'test-data', isMobile ? 'mobile' : type, `${scenario}.json`),
  locatorsDir: isMobile ? path.join(outputDir, 'locators', 'mobile') : path.join(outputDir, 'locators'),
  pagesDir: isMobile ? path.join(outputDir, 'screens') : path.join(outputDir, 'pages'),
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

function listScreenFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(f =>
    (f.endsWith('Screen.ts') || f.endsWith('Screen.js')) && !f.includes('.helpers.'),
  );
}

function countMobileElementSelectors(entry) {
  // Returns the number of distinct strategies provided across all platforms.
  // A "good" mobile entry has at least 2 strategies for at least one platform.
  let total = 0;
  for (const platformKey of ['android', 'ios']) {
    const platformEntry = entry[platformKey];
    if (!platformEntry || typeof platformEntry !== 'object') continue;
    for (const k of Object.keys(platformEntry)) {
      if (!k.startsWith('_') && platformEntry[k]) total++;
    }
  }
  return total;
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

    let missingFallbacks = 0;
    if (isMobile) {
      // Mobile entries: check that at least one platform has >= 1 strategy.
      // Soft "fallback" check: an element with only 1 strategy across all
      // platforms is flagged as low-quality.
      for (const [_key, value] of Object.entries(json)) {
        if (countMobileElementSelectors(value) < 2) missingFallbacks++;
      }
    } else {
      // Web entries: check that fallbacks[] has >= 2 entries.
      for (const [_key, value] of Object.entries(json)) {
        if (!value.fallbacks || value.fallbacks.length < 2) {
          missingFallbacks++;
        }
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
// 3. Page/Screen object inventory
// ---------------------------------------------------------------------------
const pageFiles = isMobile
  ? listScreenFiles(paths.pagesDir)
  : listPageFiles(paths.pagesDir);

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
  if (isMobile) {
    // Mobile spec: count `// Step N — ...` comment markers (no test.step() in WDIO/Mocha)
    specStepCount = countPattern(specContent, /^\s*\/\/\s*Step\s+\d+\s*—/gm);

    specKeywords.expect = countPattern(specContent, /\bexpect\(/g);
    specKeywords.expectSoft = countPattern(specContent, /softAssertions\.push\(/g);
    specKeywords.screenshot = countPattern(specContent, /\.takeScreenshot\(/g);
    specKeywords.annotationsPush = countPattern(specContent, /console\.log\(/g);
    specKeywords.attach = 0;
  } else {
    // Web/api/hybrid: count top-level test.step('Step N ...') calls
    specStepCount = countPattern(specContent, /await test\.step\([`'"]Step \d+/g);

    specKeywords.expect = countPattern(specContent, /\bexpect\(/g);
    specKeywords.expectSoft = countPattern(specContent, /\bexpect\.soft\(/g);
    specKeywords.screenshot = countPattern(specContent, /page\.screenshot\(/g);
    specKeywords.annotationsPush = countPattern(specContent, /annotations\.push\(/g);
    specKeywords.attach = countPattern(specContent, /test\.info\(\)\.attach\(/g);
  }
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
  if (isMobile) {
    // Mobile spec: raw driver.$('...') / browser.$('...') calls (NOT through a screen object)
    rawSelectorsInSpec =
      countPattern(specContent, /\bdriver\.\$\(/g) +
      countPattern(specContent, /\bbrowser\.\$\(/g);
  } else {
    // Web/api/hybrid: page.locator('...') calls
    rawSelectorsInSpec = countPattern(specContent, /page\.locator\(/g);
  }
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
  const callDesc = isMobile ? 'driver.$()/browser.$()' : 'page.locator()';
  result.warnings.push(`RAW SELECTORS: ${rawSelectorsInSpec} ${callDesc} calls found in spec file`);
}
for (const loc of locatorInventory) {
  if (loc.missingFallbacks > 0) {
    const noun = isMobile ? 'strategies (across all platforms)' : 'fallbacks';
    result.warnings.push(`FALLBACKS: ${loc.file} has ${loc.missingFallbacks} elements with fewer than 2 ${noun}`);
  }
}

console.log(JSON.stringify(result, null, 2));
