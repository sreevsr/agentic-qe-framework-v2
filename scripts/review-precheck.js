#!/usr/bin/env node

/**
 * review-precheck.js — Evidence collector for the Pipeline Reviewer
 *
 * DESIGN PRINCIPLE: This script is a performance optimization, not a correctness
 * dependency. It collects mechanical evidence (file existence, pattern counts,
 * config values) that the LLM reviewer would otherwise need to read files for.
 *
 * - The script NEVER decides pass/fail or scores dimensions.
 * - The script declares what it checked via `checksPerformed`.
 * - The script detects when dimensions.md rules change via rule fingerprinting.
 * - If a rule changes and the script hasn't been updated, `ruleDrift` flags it
 *   and the LLM reviewer reads the files itself for that dimension.
 * - The pipeline never breaks if this script is outdated — it just runs slower.
 *
 * Usage:
 *   node scripts/review-precheck.js --scenario=<name> --type=<web|api|hybrid> [--folder=<folder>]
 *
 * Output:
 *   output/[{folder}/]precheck-report-{scenario}.json
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

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

// --rehash mode must be checked before scenario validation
if (process.argv.includes('--rehash')) {
  rehash();
}

if (!scenario) {
  console.error('Usage: node scripts/review-precheck.js --scenario=<name> --type=<web|api|hybrid> [--folder=<folder>]');
  console.error('       node scripts/review-precheck.js --rehash');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Path resolution (mirrors agents/_shared/path-resolution.md)
// ---------------------------------------------------------------------------
const ROOT = path.resolve(__dirname, '..');
const OUTPUT = path.join(ROOT, 'output');

function resolve(...segments) {
  return path.join(ROOT, ...segments);
}

const paths = {
  dimensionsMd: resolve('agents', '04-reviewer', 'dimensions.md'),
  scenarioMd: folder
    ? resolve('scenarios', type, folder, `${scenario}.md`)
    : resolve('scenarios', type, `${scenario}.md`),
  explorerReport: folder
    ? path.join(OUTPUT, 'reports', folder, `explorer-report-${scenario}.md`)
    : path.join(OUTPUT, 'reports', `explorer-report-${scenario}.md`),
  specFile: folder
    ? path.join(OUTPUT, 'tests', type, folder, `${scenario}.spec.ts`)
    : path.join(OUTPUT, 'tests', type, `${scenario}.spec.ts`),
  playwrightConfig: path.join(OUTPUT, 'playwright.config.ts'),
  packageJson: path.join(OUTPUT, 'package.json'),
  envExample: path.join(OUTPUT, '.env.example'),
  executorReport: folder
    ? path.join(OUTPUT, 'reports', folder, `executor-report-${scenario}.md`)
    : path.join(OUTPUT, 'reports', `executor-report-${scenario}.md`),
  gitignore: resolve('.gitignore'),
  outputDir: OUTPUT,
};

const outputPath = folder
  ? path.join(OUTPUT, 'reports', folder, `precheck-report-${scenario}.json`)
  : path.join(OUTPUT, 'reports', `precheck-report-${scenario}.json`);

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------
function readFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
}

function fileExists(filePath) {
  return fs.existsSync(filePath);
}

function grepFile(filePath, pattern) {
  const content = readFile(filePath);
  if (!content) return [];
  const regex = pattern instanceof RegExp ? pattern : new RegExp(pattern, 'g');
  const lines = content.split('\n');
  const matches = [];
  lines.forEach((line, i) => {
    if (regex.test(line)) {
      matches.push({ line: i + 1, text: line.trim() });
    }
    regex.lastIndex = 0; // reset for global regex
  });
  return matches;
}

function grepFiles(filePaths, pattern) {
  const results = [];
  filePaths.forEach(fp => {
    grepFile(fp, pattern).forEach(m => {
      results.push({ file: path.relative(ROOT, fp), ...m });
    });
  });
  return results;
}

function countPattern(content, pattern) {
  if (!content) return 0;
  const matches = content.match(pattern);
  return matches ? matches.length : 0;
}

// ---------------------------------------------------------------------------
// Rule fingerprinting — detect drift between dimensions.md and this script
// ---------------------------------------------------------------------------
function hashSection(text) {
  return crypto.createHash('sha256').update(text.trim()).digest('hex').slice(0, 12);
}

function parseDimensionSections(dimensionsContent) {
  if (!dimensionsContent) return {};
  const sections = {};
  const parts = dimensionsContent.split(/^## (\d+)\.\s/m);
  // parts: [preamble, "1", "Locator Quality...", "2", "Wait Strategy...", ...]
  for (let i = 1; i < parts.length; i += 2) {
    const dimNum = parts[i];
    const dimBody = parts[i + 1] || '';
    sections[dimNum] = dimBody;
  }
  return sections;
}

/**
 * Known rule hashes — updated when a developer reviews a rule change
 * and confirms the evidence collection logic is still correct.
 *
 * To regenerate after reviewing a rule change:
 *   node scripts/review-precheck.js --rehash
 */
const KNOWN_RULE_HASHES = {
  '1': '092feb7dab69', // Locator Quality
  '2': '0953a4cadc81', // Wait Strategy
  '3': 'eee061e469b7', // Test Architecture
  '4': '8e0cf0139baa', // Configuration
  '5': 'c0b0235f8565', // Code Quality
  '6': '831da91278e2', // Maintainability
  '7': 'ca98aa628a0e', // Security
  '8': '3c453e02a8dd', // API Test Quality
  '9': '43a18e55037d', // Scenario-to-Code Fidelity
};

// Dimensions that have NO mechanical checks in this script
const DIMENSIONS_WITHOUT_CHECKS = ['6'];

function computeRuleDrift(dimensionsContent) {
  const sections = parseDimensionSections(dimensionsContent);
  const drift = [];

  for (const [dimNum, body] of Object.entries(sections)) {
    const currentHash = hashSection(body);
    const knownHash = KNOWN_RULE_HASHES[dimNum];
    const dimName = body.split('\n')[0].trim().replace(/\(Weight:.*$/, '').trim();

    if (DIMENSIONS_WITHOUT_CHECKS.includes(dimNum)) {
      drift.push({
        dimension: dimNum,
        name: dimName,
        status: 'NO_MECHANICAL_CHECKS',
        message: `No mechanical checks exist for Dimension ${dimNum}. LLM handles this dimension entirely.`,
      });
    } else if (!knownHash) {
      drift.push({
        dimension: dimNum,
        name: dimName,
        status: 'UNKNOWN',
        message: `Dimension ${dimNum} has no known hash — evidence may be incomplete.`,
      });
    } else if (currentHash !== knownHash) {
      drift.push({
        dimension: dimNum,
        name: dimName,
        status: 'MODIFIED',
        currentHash,
        knownHash,
        message: `Rule text changed since checks were last updated. LLM should verify this dimension by reading files directly.`,
      });
    }
    // If hashes match → no drift entry (clean)
  }

  return drift;
}

// --rehash mode: print current hashes and exit
function rehash() {
  const dimensionsMdPath = path.resolve(__dirname, '..', 'agents', '04-reviewer', 'dimensions.md');
  const content = readFile(dimensionsMdPath);
  if (!content) {
    console.error('Cannot read dimensions.md');
    process.exit(1);
  }
  const sections = parseDimensionSections(content);
  console.log('// Updated KNOWN_RULE_HASHES — paste into review-precheck.js:');
  console.log('const KNOWN_RULE_HASHES = {');
  for (const [dimNum, body] of Object.entries(sections)) {
    const hash = hashSection(body);
    const name = body.split('\n')[0].trim().replace(/\(Weight:.*$/, '').trim();
    console.log(`  '${dimNum}': '${hash}', // ${name}`);
  }
  console.log('};');
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Explorer report parsing — extract file manifest
// ---------------------------------------------------------------------------
function parseExplorerManifest() {
  const content = readFile(paths.explorerReport);
  if (!content) return { found: false, locatorFiles: [], pageFiles: [], testDataFiles: [], helperFiles: [] };

  const locatorFiles = [];
  const pageFiles = [];
  const testDataFiles = [];
  const helperFiles = [];

  // Extract file paths from markdown tables: | output/locators/xxx.json | ...
  const lines = content.split('\n');
  for (const line of lines) {
    const fileMatch = line.match(/\|\s*(output\/\S+)\s*\|/);
    if (fileMatch) {
      const fp = fileMatch[1];
      if (fp.includes('/locators/') && fp.endsWith('.json')) locatorFiles.push(path.join(ROOT, fp));
      else if (fp.includes('/pages/') && fp.endsWith('.helpers.ts')) helperFiles.push(path.join(ROOT, fp));
      else if (fp.includes('/pages/') && fp.endsWith('.ts')) pageFiles.push(path.join(ROOT, fp));
      else if (fp.includes('/test-data/') && fp.endsWith('.json')) testDataFiles.push(path.join(ROOT, fp));
    }
  }

  return { found: true, locatorFiles, pageFiles, testDataFiles, helperFiles };
}

// ---------------------------------------------------------------------------
// Evidence collectors — one per dimension (mechanical checks only)
// ---------------------------------------------------------------------------

function collectDim1_LocatorQuality(manifest) {
  const evidence = {
    locatorFiles: [],
    rawSelectorsInSpec: [],
    rawSelectorsInPages: [],
  };

  // Check each locator JSON for primary + fallbacks
  for (const fp of manifest.locatorFiles) {
    const content = readFile(fp);
    if (!content) {
      evidence.locatorFiles.push({ file: path.relative(ROOT, fp), exists: false });
      continue;
    }
    try {
      const json = JSON.parse(content);
      const elements = Object.entries(json);
      let minFallbacks = Infinity;
      let maxFallbacks = 0;
      let missingPrimary = [];
      let missingFallbacks = [];

      for (const [name, entry] of elements) {
        if (!entry.primary) missingPrimary.push(name);
        const fallbackCount = Array.isArray(entry.fallbacks) ? entry.fallbacks.length : 0;
        if (fallbackCount < 2) missingFallbacks.push({ name, fallbackCount });
        minFallbacks = Math.min(minFallbacks, fallbackCount);
        maxFallbacks = Math.max(maxFallbacks, fallbackCount);
      }

      evidence.locatorFiles.push({
        file: path.relative(ROOT, fp),
        exists: true,
        elementCount: elements.length,
        minFallbacks: minFallbacks === Infinity ? 0 : minFallbacks,
        maxFallbacks,
        missingPrimary,
        missingFallbacks,
      });
    } catch (e) {
      evidence.locatorFiles.push({ file: path.relative(ROOT, fp), exists: true, parseError: e.message });
    }
  }

  // Grep for raw selectors in spec (page.locator, page.$(, page.$$()
  const rawSelectorPattern = /page\.(locator|getByRole|getByText|getByLabel|getByTestId|getByPlaceholder)\s*\(/;
  if (fileExists(paths.specFile)) {
    evidence.rawSelectorsInSpec = grepFile(paths.specFile, rawSelectorPattern)
      .map(m => ({ file: path.relative(ROOT, paths.specFile), ...m }));
  }

  // Grep for raw selectors in page objects (this.page.locator instead of this.loc.get)
  const rawInPagePattern = /this\.page\.(locator|getByRole|getByText|getByLabel|getByTestId|getByPlaceholder)\s*\(/;
  for (const fp of manifest.pageFiles) {
    const matches = grepFile(fp, rawInPagePattern);
    if (matches.length > 0) {
      evidence.rawSelectorsInPages.push(
        ...matches.map(m => ({ file: path.relative(ROOT, fp), ...m }))
      );
    }
  }

  return evidence;
}

function collectDim2_WaitStrategy(manifest) {
  const allFiles = [paths.specFile, ...manifest.pageFiles].filter(fileExists);

  // Grep for waitForTimeout (with PACING context)
  const waitForTimeoutMatches = [];
  for (const fp of allFiles) {
    const content = readFile(fp);
    if (!content) continue;
    const lines = content.split('\n');
    lines.forEach((line, i) => {
      if (/waitForTimeout\s*\(/.test(line)) {
        const prevLine = i > 0 ? lines[i - 1] : '';
        const hasPacingComment = /\/\/\s*PACING:/i.test(prevLine) || /\/\/\s*PACING:/i.test(line);
        waitForTimeoutMatches.push({
          file: path.relative(ROOT, fp),
          line: i + 1,
          text: line.trim(),
          hasPacingComment,
        });
      }
    });
  }

  // Grep for setTimeout
  const setTimeoutMatches = grepFiles(allFiles, /setTimeout\s*\(/);

  return {
    waitForTimeoutCalls: waitForTimeoutMatches,
    setTimeoutCalls: setTimeoutMatches,
  };
}

function collectDim3_TestArchitecture(manifest) {
  const specContent = readFile(paths.specFile);
  const scenarioContent = readFile(paths.scenarioMd);
  const evidence = {};

  if (specContent) {
    // Tags present on test() calls
    evidence.testsWithTags = countPattern(specContent, /test\s*\(\s*['"`][^'"`]+['"`]\s*,\s*\{[^}]*tag\s*:/g);
    evidence.testsWithoutTags = countPattern(specContent, /test\s*\(\s*['"`][^'"`]+['"`]\s*,\s*async/g);
    evidence.hasTestDescribe = /test\.describe\s*\(/.test(specContent);
    evidence.hasBeforeEach = /test\.beforeEach\s*\(/.test(specContent);
    evidence.hasBeforeAll = /test\.beforeAll\s*\(/.test(specContent);
    evidence.hasAfterEach = /test\.afterEach\s*\(/.test(specContent);
    evidence.hasAfterAll = /test\.afterAll\s*\(/.test(specContent);

    // loadTestData or loadSharedData import
    evidence.hasLoadTestData = /loadTestData|loadSharedData/.test(specContent);
  }

  // Check SHARED_DATA in scenario
  if (scenarioContent) {
    const sharedMatch = scenarioContent.match(/##\s*SHARED_DATA:\s*(.+)/);
    evidence.scenarioSharedData = sharedMatch ? sharedMatch[1].trim() : null;
  }

  // Check helpers exist and if spec imports them
  evidence.helperFiles = [];
  for (const hp of manifest.helperFiles) {
    const baseName = path.basename(hp, '.helpers.ts');
    const imported = specContent ? new RegExp(`${baseName}WithHelpers|from.*${baseName}\\.helpers`).test(specContent) : false;
    evidence.helperFiles.push({
      file: path.relative(ROOT, hp),
      exists: fileExists(hp),
      importedBySpec: imported,
    });
  }

  return evidence;
}

function collectDim4_Configuration() {
  const configContent = readFile(paths.playwrightConfig);
  if (!configContent) return { configExists: false };

  return {
    configExists: true,
    channelChrome: /channel:\s*['"]chrome['"]/.test(configContent),
    channelValue: (configContent.match(/channel:\s*['"]([^'"]+)['"]/)||[])[1] || null,
    actionTimeout: (configContent.match(/actionTimeout:\s*(\d[\d_]*)/)||[])[1] || null,
    navigationTimeout: (configContent.match(/navigationTimeout:\s*(\d[\d_]*)/)||[])[1] || null,
    globalTimeout: (configContent.match(/timeout:\s*(\d[\d_]*)/)||[])[1] || null,
    screenshot: (configContent.match(/screenshot:\s*['"]([^'"]+)['"]/)||[])[1] || null,
    trace: (configContent.match(/trace:\s*['"]([^'"]+)['"]/)||[])[1] || null,
    video: (configContent.match(/video:\s*['"]([^'"]+)['"]/)||[])[1] || null,
    hasBaseURL: /baseURL\s*:/.test(configContent),
  };
}

function collectDim5_CodeQuality() {
  const evidence = {};

  // TypeScript compilation check
  try {
    execSync('npx tsc --noEmit 2>&1', { cwd: OUTPUT, timeout: 30000, encoding: 'utf-8' });
    evidence.tscErrors = 0;
    evidence.tscOutput = null;
  } catch (e) {
    const output = (e.stdout || '') + (e.stderr || '');
    const errorCount = (output.match(/error TS\d+/g) || []).length;
    evidence.tscErrors = errorCount;
    evidence.tscOutput = output.slice(0, 2000); // truncate for report size
  }

  // Check package.json for required devDependencies
  const pkgContent = readFile(paths.packageJson);
  if (pkgContent) {
    try {
      const pkg = JSON.parse(pkgContent);
      const devDeps = pkg.devDependencies || {};
      evidence.hasTypesNode = '@types/node' in devDeps;
      evidence.hasDotenv = 'dotenv' in devDeps || 'dotenv' in (pkg.dependencies || {});
    } catch {
      evidence.hasTypesNode = null;
      evidence.hasDotenv = null;
    }
  }

  return evidence;
}

// Dim 6 (Maintainability) — no mechanical checks, handled entirely by LLM

function collectDim7_Security() {
  const specContent = readFile(paths.specFile);
  const scenarioContent = readFile(paths.scenarioMd);

  const evidence = {
    envExampleExists: fileExists(paths.envExample),
    envInGitignore: false,
    scenarioUsesEnvPattern: false,
    suspectedHardcodedCredentials: [],
  };

  // Check .gitignore for .env
  const gitignoreContent = readFile(paths.gitignore);
  if (gitignoreContent) {
    evidence.envInGitignore = /^\.env$/m.test(gitignoreContent) || /^\.env\.local$/m.test(gitignoreContent);
  }

  // Check scenario uses {{ENV.*}} pattern
  if (scenarioContent) {
    evidence.scenarioUsesEnvPattern = /\{\{ENV\./.test(scenarioContent);
    // Check for literal credential patterns (common demo creds)
    const credPatterns = /(?:password|secret|token|key)\s*[:=]\s*['"]?\w{4,}/gi;
    const credMatches = grepFile(paths.scenarioMd, credPatterns);
    if (credMatches.length > 0) {
      evidence.scenarioLiteralCredentials = credMatches.map(m => ({
        file: path.relative(ROOT, paths.scenarioMd), ...m,
      }));
    }
  }

  // Check spec for hardcoded strings that look like credentials
  if (specContent) {
    // Look for string literals passed to fill() that aren't process.env or testData
    const fillPattern = /\.fill\s*\(\s*['"][^'"]*['"]\s*,\s*['"]([^'"]{4,})['"]\s*\)/g;
    let match;
    while ((match = fillPattern.exec(specContent)) !== null) {
      const value = match[1];
      if (!/process\.env|testData|sharedData/.test(match[0])) {
        evidence.suspectedHardcodedCredentials.push({
          file: path.relative(ROOT, paths.specFile),
          value: value.slice(0, 20) + (value.length > 20 ? '...' : ''),
          context: match[0].slice(0, 80),
        });
      }
    }
  }

  return evidence;
}

function collectDim8_ApiTestQuality() {
  if (type === 'web') return { applicable: false };

  const specContent = readFile(paths.specFile);
  if (!specContent) return { applicable: true, specExists: false };

  return {
    applicable: true,
    specExists: true,
    usesRequestFixture: /\{\s*(?:page\s*,\s*)?request\s*[,}]/.test(specContent),
    usesAxios: /require\s*\(\s*['"]axios['"]\)|import.*from\s*['"]axios['"]/.test(specContent),
    usesFetch: /\bfetch\s*\(/.test(specContent),
    requestPostCalls: countPattern(specContent, /request\.post\s*\(/g),
    requestGetCalls: countPattern(specContent, /request\.get\s*\(/g),
    requestPutCalls: countPattern(specContent, /request\.put\s*\(/g),
    requestPatchCalls: countPattern(specContent, /request\.patch\s*\(/g),
    requestDeleteCalls: countPattern(specContent, /request\.delete\s*\(/g),
    statusAssertions: countPattern(specContent, /\.status\(\)\)\.toBe\(/g),
  };
}

function collectTestExecution() {
  const content = readFile(paths.executorReport);
  if (!content) return { executorReportFound: false };

  const evidence = { executorReportFound: true };

  // Extract test pass/fail counts from the Summary table
  // Look for patterns like "Passed | 1" or "Total tests | 1" or "1/1 passed"
  const passedMatch = content.match(/\|\s*Passed\s*\|\s*(\d+)/i)
    || content.match(/(\d+)\s*passed/i);
  const failedMatch = content.match(/\|\s*Failed\s*\|\s*(\d+)/i)
    || content.match(/(\d+)\s*failed/i);
  const totalMatch = content.match(/\|\s*Total tests\s*\|\s*(\d+)/i);
  const fixmeMatch = content.match(/\|\s*test\.fixme\(\)\s*\|\s*(\d+)/i);
  const fixCyclesMatch = content.match(/\|\s*Fix cycles used\s*\|\s*(\d+)\s*of\s*(\d+)/i)
    || content.match(/Fix Cycles:\s*(\d+)\s*of\s*(\d+)/i);

  evidence.testsPassed = passedMatch ? parseInt(passedMatch[1], 10) : null;
  evidence.testsFailed = failedMatch ? parseInt(failedMatch[1], 10) : null;
  evidence.testsTotal = totalMatch ? parseInt(totalMatch[1], 10) : null;
  evidence.testFixme = fixmeMatch ? parseInt(fixmeMatch[1], 10) : null;
  evidence.fixCyclesUsed = fixCyclesMatch ? parseInt(fixCyclesMatch[1], 10) : null;
  evidence.fixCyclesMax = fixCyclesMatch ? parseInt(fixCyclesMatch[2], 10) : null;

  // Determine overall status
  const statusMatch = content.match(/\|\s*Status\s*\|\s*\*\*(.+?)\*\*/i);
  if (statusMatch) {
    evidence.executorStatus = statusMatch[1].trim();
  } else if (content.match(/ALL PASSING/i)) {
    evidence.executorStatus = 'ALL PASSING';
  } else if (content.match(/IN PROGRESS/i)) {
    evidence.executorStatus = 'IN PROGRESS';
  } else if (content.match(/REMAINING FAILURES/i)) {
    evidence.executorStatus = 'REMAINING FAILURES';
  } else {
    evidence.executorStatus = 'UNKNOWN';
  }

  // Derive a boolean for easy consumption
  evidence.allTestsPassing = evidence.executorStatus === 'ALL PASSING'
    || (evidence.testsPassed !== null && evidence.testsFailed !== null
        && evidence.testsFailed === 0 && evidence.testsPassed > 0);

  return evidence;
}

function collectDim9_Fidelity() {
  const specContent = readFile(paths.specFile);
  const scenarioContent = readFile(paths.scenarioMd);

  const evidence = {
    scenarioSteps: { total: 0, sections: {} },
    specTestSteps: 0,
    keywords: {},
    lifecycleHooks: { scenario: {}, spec: {} },
  };

  // --- Count scenario steps ---
  if (scenarioContent) {
    const lines = scenarioContent.split('\n');
    let currentSection = 'main';
    let stepCount = 0;
    const sectionCounts = {};

    for (const line of lines) {
      // Detect section headers
      if (/^##\s*Common Setup Once/i.test(line)) { currentSection = 'commonSetupOnce'; continue; }
      if (/^##\s*Common Setup/i.test(line)) { currentSection = 'commonSetup'; continue; }
      if (/^##\s*Common Teardown Once/i.test(line)) { currentSection = 'commonTeardownOnce'; continue; }
      if (/^##\s*Common Teardown/i.test(line)) { currentSection = 'commonTeardown'; continue; }
      if (/^###\s*Scenario:/i.test(line) || /^\*\*Phase\s/i.test(line)) { currentSection = 'main'; continue; }
      if (/^##\s*Steps/i.test(line)) { currentSection = 'main'; continue; }

      // Count numbered steps (positional)
      if (/^\s*\d+\.\s/.test(line)) {
        stepCount++;
        sectionCounts[currentSection] = (sectionCounts[currentSection] || 0) + 1;
      }
    }

    evidence.scenarioSteps.total = stepCount;
    evidence.scenarioSteps.sections = sectionCounts;

    // Count keywords in scenario
    evidence.keywords.VERIFY = { scenario: countPattern(scenarioContent, /\bVERIFY(?:_SOFT)?:/g) };
    evidence.keywords.VERIFY_hard = { scenario: countPattern(scenarioContent, /\bVERIFY:(?!.*SOFT)/g) };
    evidence.keywords.VERIFY_SOFT = { scenario: countPattern(scenarioContent, /\bVERIFY_SOFT:/g) };
    evidence.keywords.CAPTURE = { scenario: countPattern(scenarioContent, /\bCAPTURE:/g) };
    evidence.keywords.SCREENSHOT = { scenario: countPattern(scenarioContent, /\bSCREENSHOT:/g) };
    evidence.keywords.REPORT = { scenario: countPattern(scenarioContent, /\bREPORT:/g) };
    evidence.keywords.SAVE = { scenario: countPattern(scenarioContent, /\bSAVE:/g) };
    evidence.keywords.CALCULATE = { scenario: countPattern(scenarioContent, /\bCALCULATE:/g) };
    evidence.keywords.USE_HELPER = { scenario: countPattern(scenarioContent, /\bUSE_HELPER:/g) };
    evidence.keywords.API_steps = {
      scenario: countPattern(scenarioContent, /\bAPI\s+(POST|GET|PUT|PATCH|DELETE):/g),
    };

    // Lifecycle hooks in scenario
    evidence.lifecycleHooks.scenario = {
      commonSetupOnce: /^##\s*Common Setup Once/im.test(scenarioContent),
      commonSetup: /^##\s*Common Setup\b/im.test(scenarioContent),
      commonTeardown: /^##\s*Common Teardown\b(?!\s*Once)/im.test(scenarioContent),
      commonTeardownOnce: /^##\s*Common Teardown Once/im.test(scenarioContent),
    };

    // SHARED_DATA declaration
    evidence.sharedData = (scenarioContent.match(/##\s*SHARED_DATA:\s*(.+)/)||[])[1] || null;

    // API Behavior declaration
    evidence.apiBehavior = (scenarioContent.match(/##\s*API Behavior:\s*(\w+)/)||[])[1] || null;
  }

  // --- Count spec patterns ---
  if (specContent) {
    evidence.specTestSteps = countPattern(specContent, /test\.step\s*\(/g);
    evidence.specTestStepsNote = 'Includes nested test.step() calls (e.g., multi-assertion VERIFY blocks). Compare with scenarioSteps.total for fidelity — a delta may be expected when steps use nested sub-assertions.';

    // Keywords in spec
    evidence.keywords.VERIFY = {
      ...evidence.keywords.VERIFY,
      spec_expect: countPattern(specContent, /\bexpect\s*\(/g),
    };
    evidence.keywords.VERIFY_SOFT = {
      ...evidence.keywords.VERIFY_SOFT,
      spec_expectSoft: countPattern(specContent, /\bexpect\.soft\s*\(/g),
    };
    evidence.keywords.CAPTURE = {
      ...evidence.keywords.CAPTURE,
      spec_note: 'Variable assignments — LLM must verify semantics',
    };
    evidence.keywords.SCREENSHOT = {
      ...evidence.keywords.SCREENSHOT,
      spec_screenshot: countPattern(specContent, /page\.screenshot\s*\(/g),
      spec_attach: countPattern(specContent, /test\.info\(\)\.attach\s*\(/g),
    };
    evidence.keywords.REPORT = {
      ...evidence.keywords.REPORT,
      spec_annotationsPush: countPattern(specContent, /test\.info\(\)\.annotations\.push\s*\(/g),
    };
    evidence.keywords.SAVE = {
      ...evidence.keywords.SAVE,
      spec_saveState: countPattern(specContent, /saveState\s*\(/g),
    };
    evidence.keywords.API_steps = {
      ...evidence.keywords.API_steps,
      spec_requestCalls: countPattern(specContent, /request\.(post|get|put|patch|delete)\s*\(/g),
    };

    // Lifecycle hooks in spec
    evidence.lifecycleHooks.spec = {
      beforeAll: /test\.beforeAll\s*\(/.test(specContent),
      beforeEach: /test\.beforeEach\s*\(/.test(specContent),
      afterEach: /test\.afterEach\s*\(/.test(specContent),
      afterAll: /test\.afterAll\s*\(/.test(specContent),
    };

    // SHARED_DATA in spec
    evidence.specHasLoadTestData = /loadTestData|loadSharedData/.test(specContent);
  }

  return evidence;
}

// ---------------------------------------------------------------------------
// Main — assemble the precheck report
// ---------------------------------------------------------------------------
function main() {
  console.log(`[review-precheck] Scenario: ${scenario} | Type: ${type} | Folder: ${folder || 'N/A'}`);

  // Rule fingerprinting
  const dimensionsContent = readFile(paths.dimensionsMd);
  const ruleDrift = dimensionsContent ? computeRuleDrift(dimensionsContent) : [{
    dimension: 'ALL',
    status: 'MISSING',
    message: 'dimensions.md not found — LLM must handle all dimensions directly.',
  }];

  // Parse explorer report for file manifest
  const manifest = parseExplorerManifest();
  if (!manifest.found) {
    console.warn(`[review-precheck] WARNING: Explorer report not found at ${paths.explorerReport}`);
    console.warn('[review-precheck] Using default file discovery from output/ directory.');
  }

  // If manifest is empty, try to discover files from output/ directly
  if (manifest.locatorFiles.length === 0) {
    const locatorsDir = path.join(OUTPUT, 'locators');
    if (fs.existsSync(locatorsDir)) {
      fs.readdirSync(locatorsDir)
        .filter(f => f.endsWith('.locators.json'))
        .forEach(f => manifest.locatorFiles.push(path.join(locatorsDir, f)));
    }
  }
  if (manifest.pageFiles.length === 0) {
    const pagesDir = path.join(OUTPUT, 'pages');
    if (fs.existsSync(pagesDir)) {
      fs.readdirSync(pagesDir)
        .filter(f => f.endsWith('.ts') && !f.endsWith('.helpers.ts'))
        .forEach(f => manifest.pageFiles.push(path.join(pagesDir, f)));
    }
  }
  if (manifest.helperFiles.length === 0) {
    const pagesDir = path.join(OUTPUT, 'pages');
    if (fs.existsSync(pagesDir)) {
      fs.readdirSync(pagesDir)
        .filter(f => f.endsWith('.helpers.ts'))
        .forEach(f => manifest.helperFiles.push(path.join(pagesDir, f)));
    }
  }

  // Collect evidence
  console.log('[review-precheck] Collecting evidence...');
  const evidence = {
    dim1_locatorQuality: collectDim1_LocatorQuality(manifest),
    dim2_waitStrategy: collectDim2_WaitStrategy(manifest),
    dim3_testArchitecture: collectDim3_TestArchitecture(manifest),
    dim4_configuration: collectDim4_Configuration(),
    dim5_codeQuality: collectDim5_CodeQuality(),
    // dim6 — no mechanical checks
    dim7_security: collectDim7_Security(),
    dim8_apiTestQuality: collectDim8_ApiTestQuality(),
    dim9_fidelity: collectDim9_Fidelity(),
    dim_testExecution: collectTestExecution(),
  };

  // Build the report
  const report = {
    version: '1.0',
    generatedAt: new Date().toISOString(),
    scenario,
    type,
    folder: folder || null,
    specFile: fileExists(paths.specFile) ? path.relative(ROOT, paths.specFile) : null,
    scenarioFile: fileExists(paths.scenarioMd) ? path.relative(ROOT, paths.scenarioMd) : null,
    explorerReportFound: manifest.found,
    manifest: {
      locatorFiles: manifest.locatorFiles.map(f => path.relative(ROOT, f)),
      pageFiles: manifest.pageFiles.map(f => path.relative(ROOT, f)),
      helperFiles: manifest.helperFiles.map(f => path.relative(ROOT, f)),
      testDataFiles: manifest.testDataFiles.map(f => path.relative(ROOT, f)),
    },
    checksPerformed: [
      'dim1.fallbackCount',
      'dim1.rawSelectorsInSpec',
      'dim1.rawSelectorsInPages',
      'dim2.waitForTimeoutCalls',
      'dim2.setTimeoutCalls',
      'dim2.pacingCommentContext',
      'dim3.tagsPresent',
      'dim3.testDescribe',
      'dim3.lifecycleHooks',
      'dim3.loadTestDataImport',
      'dim3.helperImports',
      'dim4.channelChrome',
      'dim4.timeouts',
      'dim4.screenshotConfig',
      'dim4.traceConfig',
      'dim4.videoConfig',
      'dim4.baseURL',
      'dim5.tscErrors',
      'dim5.typesNode',
      'dim5.dotenv',
      'dim7.envExampleExists',
      'dim7.envInGitignore',
      'dim7.scenarioEnvPattern',
      'dim7.suspectedCredentials',
      'dim8.requestFixture',
      'dim8.noAxiosFetch',
      'dim8.statusAssertionCount',
      'dim9.stepCount',
      'dim9.keywordCounts',
      'dim9.lifecycleHooks',
      'dim9.sharedData',
      'dim9.apiBehavior',
      'testExecution.executorStatus',
      'testExecution.passFailCounts',
      'testExecution.fixCycles',
    ],
    ruleDrift,
    evidence,
  };

  // Write the report
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
  console.log(`[review-precheck] Report saved to ${path.relative(ROOT, outputPath)}`);

  // Print summary
  const driftCount = ruleDrift.filter(d => d.status === 'MODIFIED').length;
  const checksCount = report.checksPerformed.length;
  console.log(`[review-precheck] ${checksCount} checks performed | ${driftCount} rule drift(s) detected`);

  if (driftCount > 0) {
    console.log('[review-precheck] Drifted dimensions (LLM will read files directly):');
    ruleDrift.filter(d => d.status === 'MODIFIED').forEach(d => {
      console.log(`  - Dimension ${d.dimension}: ${d.name}`);
    });
  }
}

main();
