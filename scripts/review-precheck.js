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
 *   node scripts/review-precheck.js --scenario=<name> --type=<web|api|hybrid|mobile|mobile-hybrid> [--folder=<folder>]
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
  console.error('Usage: node scripts/review-precheck.js --scenario=<name> --type=<web|api|hybrid|mobile|mobile-hybrid> [--folder=<folder>]');
  console.error('       node scripts/review-precheck.js --rehash');
  process.exit(1);
}

const isMobile = type === 'mobile' || type === 'mobile-hybrid';
// Mobile scenarios + specs always live under the `mobile/` subtree, regardless of variant.
// Mobile scenarios are FLAT (`scenarios/mobile/{scenario}.md`) — folder is NOT applied
// to the scenario path. Mobile specs DO use folder subdirs (`output/tests/mobile/{folder}/...`).
const sceneTypeDir = isMobile ? 'mobile' : type;
const scenarioFolderForResolve = isMobile ? null : folder;

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
  scenarioMd: scenarioFolderForResolve
    ? resolve('scenarios', sceneTypeDir, scenarioFolderForResolve, `${scenario}.md`)
    : resolve('scenarios', sceneTypeDir, `${scenario}.md`),
  explorerReport: folder
    ? path.join(OUTPUT, 'reports', folder, `explorer-report-${scenario}.md`)
    : path.join(OUTPUT, 'reports', `explorer-report-${scenario}.md`),
  specFile: folder
    ? path.join(OUTPUT, 'tests', sceneTypeDir, folder, `${scenario}.spec.ts`)
    : path.join(OUTPUT, 'tests', sceneTypeDir, `${scenario}.spec.ts`),
  playwrightConfig: path.join(OUTPUT, 'playwright.config.ts'),
  wdioConfig: path.join(OUTPUT, 'wdio.conf.ts'),
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
      else if (fp.includes('/screens/') && fp.endsWith('.helpers.ts')) helperFiles.push(path.join(ROOT, fp));
      else if (fp.includes('/screens/') && fp.endsWith('.ts')) pageFiles.push(path.join(ROOT, fp));
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

  // Check each locator JSON for primary + fallbacks (web) or platform strategies (mobile)
  for (const fp of manifest.locatorFiles) {
    const content = readFile(fp);
    if (!content) {
      evidence.locatorFiles.push({ file: path.relative(ROOT, fp), exists: false });
      continue;
    }
    try {
      const json = JSON.parse(content);
      const elements = Object.entries(json);
      const isMobileLocator = isMobile || fp.includes(`${path.sep}locators${path.sep}mobile${path.sep}`)
        || fp.includes('/locators/mobile/');

      if (isMobileLocator) {
        let minStrategies = Infinity;
        let maxStrategies = 0;
        const missingFallbacks = [];
        const hardcodedTestValues = [];

        for (const [name, entry] of elements) {
          let count = 0;
          for (const platform of ['android', 'ios']) {
            const pe = entry[platform];
            if (pe && typeof pe === 'object') {
              for (const k of Object.keys(pe)) {
                if (!k.startsWith('_') && pe[k]) count++;
              }
            }
          }
          if (count < 2) missingFallbacks.push({ name, strategyCount: count });
          minStrategies = Math.min(minStrategies, count);
          maxStrategies = Math.max(maxStrategies, count);

          // Heuristic: flag obvious AP-1 (hardcoded test values) — currency symbols + digits,
          // long product-name fragments, etc. LLM will read the file for the final call.
          const text = JSON.stringify(entry);
          if (/textContains\("[^"]{20,}"\)/.test(text)) {
            hardcodedTestValues.push({ name, hint: 'long textContains() string — possible AP-1' });
          }
          if (/text\("[₹$€£][\d,.]+"\)/.test(text)) {
            hardcodedTestValues.push({ name, hint: 'price literal — possible AP-1' });
          }
        }

        evidence.locatorFiles.push({
          file: path.relative(ROOT, fp),
          format: 'mobile',
          exists: true,
          elementCount: elements.length,
          minStrategies: minStrategies === Infinity ? 0 : minStrategies,
          maxStrategies,
          missingFallbacks,
          hardcodedTestValues,
        });
      } else {
        let minFallbacks = Infinity;
        let maxFallbacks = 0;
        const missingPrimary = [];
        const missingFallbacks = [];

        for (const [name, entry] of elements) {
          if (!entry.primary) missingPrimary.push(name);
          const fallbackCount = Array.isArray(entry.fallbacks) ? entry.fallbacks.length : 0;
          if (fallbackCount < 2) missingFallbacks.push({ name, fallbackCount });
          minFallbacks = Math.min(minFallbacks, fallbackCount);
          maxFallbacks = Math.max(maxFallbacks, fallbackCount);
        }

        evidence.locatorFiles.push({
          file: path.relative(ROOT, fp),
          format: 'web',
          exists: true,
          elementCount: elements.length,
          minFallbacks: minFallbacks === Infinity ? 0 : minFallbacks,
          maxFallbacks,
          missingPrimary,
          missingFallbacks,
        });
      }
    } catch (e) {
      evidence.locatorFiles.push({ file: path.relative(ROOT, fp), exists: true, parseError: e.message });
    }
  }

  // Raw selectors in spec
  if (fileExists(paths.specFile)) {
    if (isMobile) {
      // Mobile spec: raw driver.$('...') / browser.$('...') outside of loc.get()
      const mobileRawPattern = /\b(driver|browser)\.\$\(/;
      evidence.rawSelectorsInSpec = grepFile(paths.specFile, mobileRawPattern)
        .map(m => ({ file: path.relative(ROOT, paths.specFile), ...m }));
    } else {
      const rawSelectorPattern = /page\.(locator|getByRole|getByText|getByLabel|getByTestId|getByPlaceholder)\s*\(/;
      evidence.rawSelectorsInSpec = grepFile(paths.specFile, rawSelectorPattern)
        .map(m => ({ file: path.relative(ROOT, paths.specFile), ...m }));
    }
  }

  // Raw selectors in page/screen objects
  for (const fp of manifest.pageFiles) {
    const isScreen = fp.endsWith('Screen.ts') || fp.endsWith('Screen.js');
    const pattern = isScreen
      ? /this\.driver\.\$\(/
      : /this\.page\.(locator|getByRole|getByText|getByLabel|getByTestId|getByPlaceholder)\s*\(/;
    const matches = grepFile(fp, pattern);
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

  // For mobile, look for browser.pause()/driver.pause() (the WDIO equivalent of waitForTimeout).
  // For web, look for page.waitForTimeout().
  const pauseRegex = isMobile
    ? /\b(?:browser|driver)\.pause\s*\(/
    : /waitForTimeout\s*\(/;

  const waitForTimeoutMatches = [];
  for (const fp of allFiles) {
    const content = readFile(fp);
    if (!content) continue;
    const lines = content.split('\n');
    lines.forEach((line, i) => {
      if (pauseRegex.test(line)) {
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

  // Grep for setTimeout (applies to both)
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
    if (isMobile) {
      // Mocha: tags appear in the it() title string (e.g. it('test @smoke @P0', ...))
      const itCalls = specContent.match(/\bit\s*\(\s*[`'"][^`'"]+[`'"]/g) || [];
      evidence.testsWithTags = itCalls.filter((s) => /@\w+/.test(s)).length;
      evidence.testsWithoutTags = itCalls.length - evidence.testsWithTags;
      evidence.hasTestDescribe = /\bdescribe\s*\(/.test(specContent);
      evidence.hasBeforeEach = /\bbeforeEach\s*\(/.test(specContent);
      evidence.hasBeforeAll = /\bbefore\s*\(/.test(specContent);
      evidence.hasAfterEach = /\bafterEach\s*\(/.test(specContent);
      evidence.hasAfterAll = /\bafter\s*\(/.test(specContent);
    } else {
      // Tags present on test() calls
      evidence.testsWithTags = countPattern(specContent, /test\s*\(\s*['"`][^'"`]+['"`]\s*,\s*\{[^}]*tag\s*:/g);
      evidence.testsWithoutTags = countPattern(specContent, /test\s*\(\s*['"`][^'"`]+['"`]\s*,\s*async/g);
      evidence.hasTestDescribe = /test\.describe\s*\(/.test(specContent);
      evidence.hasBeforeEach = /test\.beforeEach\s*\(/.test(specContent);
      evidence.hasBeforeAll = /test\.beforeAll\s*\(/.test(specContent);
      evidence.hasAfterEach = /test\.afterEach\s*\(/.test(specContent);
      evidence.hasAfterAll = /test\.afterAll\s*\(/.test(specContent);
    }

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
    const imported = specContent ? new RegExp(`${baseName}WithHelpers|applyHelpers|from.*${baseName}\\.helpers`).test(specContent) : false;
    evidence.helperFiles.push({
      file: path.relative(ROOT, hp),
      exists: fileExists(hp),
      importedBySpec: imported,
    });
  }

  // @steps drift check: verify every USE_HELPER reference has a matching @steps block
  evidence.helperStepsDrift = [];
  if (scenarioContent) {
    const useHelperRefs = scenarioContent.match(/USE_HELPER:\s*(\w+)\.(\w+)/g) || [];
    for (const ref of useHelperRefs) {
      const match = ref.match(/USE_HELPER:\s*(\w+)\.(\w+)/);
      if (!match) continue;
      const [, pageName, methodName] = match;
      const webHelper = path.join(OUTPUT, 'pages', `${pageName}.helpers.ts`);
      const mobileHelper = path.join(OUTPUT, 'screens', `${pageName}.helpers.ts`);
      const helperPath = fs.existsSync(webHelper) ? webHelper : fs.existsSync(mobileHelper) ? mobileHelper : null;

      if (!helperPath) {
        evidence.helperStepsDrift.push({
          reference: `${pageName}.${methodName}`,
          helperFile: null,
          fileExists: false,
          hasStepsTag: false,
          issue: `Helper file not found: ${pageName}.helpers.ts`,
        });
        continue;
      }

      const helperContent = readFile(helperPath);
      if (!helperContent) {
        evidence.helperStepsDrift.push({
          reference: `${pageName}.${methodName}`,
          helperFile: path.relative(ROOT, helperPath),
          fileExists: true,
          hasStepsTag: false,
          issue: `Helper file exists but could not be read`,
        });
        continue;
      }

      // Look for the @steps JSDoc tag above the target function
      // Pattern: /** ... @steps ... */ followed by export ... function methodName or export async function methodName
      const stepsPattern = new RegExp(
        `\\/\\*\\*[\\s\\S]*?@steps[\\s\\S]*?\\*\\/\\s*export\\s+(?:async\\s+)?function\\s+${methodName}\\b`
      );
      const hasSteps = stepsPattern.test(helperContent);

      // Also check if the function exists at all (even without @steps)
      const fnPattern = new RegExp(`export\\s+(?:async\\s+)?function\\s+${methodName}\\b`);
      const fnExists = fnPattern.test(helperContent);

      if (!fnExists) {
        evidence.helperStepsDrift.push({
          reference: `${pageName}.${methodName}`,
          helperFile: path.relative(ROOT, helperPath),
          fileExists: true,
          hasStepsTag: false,
          issue: `Function '${methodName}' not found in ${pageName}.helpers.ts`,
        });
      } else if (!hasSteps) {
        evidence.helperStepsDrift.push({
          reference: `${pageName}.${methodName}`,
          helperFile: path.relative(ROOT, helperPath),
          fileExists: true,
          hasStepsTag: false,
          issue: `Function '${methodName}' exists but has no @steps JSDoc tag — Explorer cannot walk this helper`,
        });
      } else {
        evidence.helperStepsDrift.push({
          reference: `${pageName}.${methodName}`,
          helperFile: path.relative(ROOT, helperPath),
          fileExists: true,
          hasStepsTag: true,
          issue: null,
        });
      }
    }
  }

  return evidence;
}

function collectDim4_Configuration() {
  if (isMobile) {
    const wdioContent = readFile(paths.wdioConfig);
    if (!wdioContent) return { configExists: false, configFile: 'wdio.conf.ts' };

    return {
      configExists: true,
      configFile: 'wdio.conf.ts',
      mochaTimeout: (wdioContent.match(/timeout:\s*(\d[\d_]*)/)||[])[1] || null,
      hasBeforeHook: /\bbefore\s*\(/.test(wdioContent) || /async before\s*\(\s*\)/.test(wdioContent),
      hasUiAutomatorIdleTimeout: /waitForIdleTimeout\s*:\s*0/.test(wdioContent),
      hasAfterTestScreenshot: /saveScreenshot\s*\(/.test(wdioContent),
      hasAfterTestPageSource: /getPageSource\s*\(/.test(wdioContent),
      hasAfterTestVideo: /stopRecordingScreen\s*\(/.test(wdioContent),
      hasAllureReporter: /['"]allure['"]/.test(wdioContent),
      hasJsonReporter: /['"]json['"]/.test(wdioContent),
    };
  }

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
  if (type === 'web' || type === 'mobile') return { applicable: false };

  const specContent = readFile(paths.specFile);
  if (!specContent) return { applicable: true, specExists: false };

  if (type === 'mobile-hybrid') {
    // mobile-hybrid wraps API calls in browser.call() with axios; no Playwright `request` fixture
    return {
      applicable: true,
      specExists: true,
      usesBrowserCall: /\bbrowser\.call\s*\(/.test(specContent),
      usesAxios: /require\s*\(\s*['"]axios['"]\)|import.*from\s*['"]axios['"]/.test(specContent),
      usesFetch: /\bfetch\s*\(/.test(specContent),
      axiosPostCalls: countPattern(specContent, /axios\.post\s*\(/g),
      axiosGetCalls: countPattern(specContent, /axios\.get\s*\(/g),
      axiosPutCalls: countPattern(specContent, /axios\.put\s*\(/g),
      axiosPatchCalls: countPattern(specContent, /axios\.patch\s*\(/g),
      axiosDeleteCalls: countPattern(specContent, /axios\.delete\s*\(/g),
    };
  }

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
    if (isMobile) {
      // Mobile specs use `// Step N — ...` comment markers (no test.step() in WDIO/Mocha)
      evidence.specTestSteps = countPattern(specContent, /^\s*\/\/\s*Step\s+\d+\s*—/gm);
      evidence.specTestStepsNote = 'Mobile: counted `// Step N —` comment markers (WDIO/Mocha has no test.step()).';

      evidence.keywords.VERIFY = {
        ...evidence.keywords.VERIFY,
        spec_expect: countPattern(specContent, /\bexpect\s*\(/g),
      };
      evidence.keywords.VERIFY_SOFT = {
        ...evidence.keywords.VERIFY_SOFT,
        spec_softAssertionsPush: countPattern(specContent, /softAssertions\.push\s*\(/g),
        spec_recordSoftFailure: countPattern(specContent, /\.recordSoftFailure\s*\(/g),
      };
      evidence.keywords.CAPTURE = {
        ...evidence.keywords.CAPTURE,
        spec_note: 'Variable assignments — LLM must verify semantics',
      };
      evidence.keywords.SCREENSHOT = {
        ...evidence.keywords.SCREENSHOT,
        spec_takeScreenshot: countPattern(specContent, /\.takeScreenshot\s*\(/g),
      };
      evidence.keywords.REPORT = {
        ...evidence.keywords.REPORT,
        spec_consoleLog: countPattern(specContent, /\bconsole\.log\s*\(/g),
      };
      evidence.keywords.SAVE = {
        ...evidence.keywords.SAVE,
        spec_saveState: countPattern(specContent, /saveState\s*\(/g),
      };
      evidence.keywords.API_steps = {
        ...evidence.keywords.API_steps,
        spec_browserCallAxios: countPattern(specContent, /browser\.call\s*\(/g),
      };

      evidence.lifecycleHooks.spec = {
        beforeAll: /\bbefore\s*\(/.test(specContent),
        beforeEach: /\bbeforeEach\s*\(/.test(specContent),
        afterEach: /\bafterEach\s*\(/.test(specContent),
        afterAll: /\bafter\s*\(/.test(specContent),
      };
    } else {
      evidence.specTestSteps = countPattern(specContent, /test\.step\s*\(/g);
      evidence.specTestStepsNote = 'Includes nested test.step() calls (e.g., multi-assertion VERIFY blocks). Compare with scenarioSteps.total for fidelity — a delta may be expected when steps use nested sub-assertions.';

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

      evidence.lifecycleHooks.spec = {
        beforeAll: /test\.beforeAll\s*\(/.test(specContent),
        beforeEach: /test\.beforeEach\s*\(/.test(specContent),
        afterEach: /test\.afterEach\s*\(/.test(specContent),
        afterAll: /test\.afterAll\s*\(/.test(specContent),
      };
    }

    // SHARED_DATA in spec
    evidence.specHasLoadTestData = /loadTestData|loadSharedData/.test(specContent);
  }

  // --- Test-data divergence check (scenario-locked values) ---
  // Detect test-data JSON values that differ from values stated in the scenario's
  // `## Test Data` table, when there's no matching `test.fixme` / POTENTIAL BUG
  // annotation in the spec. This surfaces the Executor guardrail violation from
  // executor.md §4.11a (silent test-data mutation to make assertions pass).
  evidence.testDataDivergence = collectTestDataDivergence(scenarioContent, specContent);

  // --- Soft-fail surfacing ---
  // Parse last-run-parsed.json for soft-expect failures. A test can report status=passed
  // while still containing N soft-expect failures that were never investigated. Surface
  // them so the Reviewer can cite specific soft-failed steps.
  evidence.softFailures = collectSoftFailures();

  return evidence;
}

// Detect test-data values that diverged from the scenario's ## Test Data table.
// Returns: { checked, divergences: [{ field, scenarioValue, testDataValue, hasFixmeAnnotation }], testDataFile, scenarioTable }
function collectTestDataDivergence(scenarioContent, specContent) {
  const result = {
    checked: false,
    divergences: [],
    testDataFiles: [],
    scenarioTableRowCount: 0,
    note: null,
  };

  if (!scenarioContent) {
    result.note = 'Scenario not readable — divergence check skipped';
    return result;
  }

  // Extract the ## Test Data markdown table from the scenario.
  // Format: | field | value | notes |
  const tdMatch = scenarioContent.match(/##\s*Test Data\s*\n([\s\S]*?)(?=\n##\s|\n---|\Z)/i);
  if (!tdMatch) {
    result.note = 'Scenario has no ## Test Data table — divergence check not applicable';
    return result;
  }
  const tableBody = tdMatch[1];
  const rowPattern = /^\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|/gm;
  const scenarioTable = {};
  let m;
  while ((m = rowPattern.exec(tableBody)) !== null) {
    const field = m[1].trim();
    const value = m[2].trim();
    // Skip header row and separator row
    if (!field || field.toLowerCase() === 'field' || /^[-:\s]+$/.test(field)) continue;
    // Skip values that are env-interpolations — those are resolved at runtime
    if (/^\{\{\s*ENV\./.test(value) || value === '—' || value === '-') continue;
    scenarioTable[field] = value;
  }
  result.scenarioTableRowCount = Object.keys(scenarioTable).length;
  if (result.scenarioTableRowCount === 0) {
    result.note = 'Scenario ## Test Data table is present but empty after filtering — divergence check skipped';
    return result;
  }

  // Collect all test-data/{type}/*.json files for this scenario.
  const typeSubdir = isMobile ? 'mobile' : type;
  const testDataDir = path.join(OUTPUT, 'test-data', typeSubdir);
  if (!fs.existsSync(testDataDir)) {
    result.note = `No test-data dir at ${path.relative(ROOT, testDataDir)}`;
    return result;
  }
  const candidates = fs
    .readdirSync(testDataDir)
    .filter(f => f.endsWith('.json'))
    .filter(f => f.toLowerCase().startsWith(scenario.toLowerCase()) || f.toLowerCase() === `${scenario.toLowerCase()}.json`);

  if (candidates.length === 0) {
    result.note = 'No matching test-data JSON found — divergence check skipped';
    return result;
  }

  result.checked = true;
  for (const f of candidates) {
    const fp = path.join(testDataDir, f);
    result.testDataFiles.push(path.relative(ROOT, fp));
    let td;
    try {
      td = JSON.parse(readFile(fp) || '{}');
    } catch {
      continue;
    }
    for (const [field, scenarioValue] of Object.entries(scenarioTable)) {
      if (!(field in td)) continue;
      const tdValue = String(td[field]);
      if (tdValue === scenarioValue) continue;
      // Divergence detected — check if spec has a fixme / POTENTIAL BUG annotation referencing this field OR its value
      const fieldRx = new RegExp(
        '(test\\.fixme|POTENTIAL BUG|potentialBug)[\\s\\S]{0,400}?' +
          '(' + escapeRx(field) + '|' + escapeRx(scenarioValue) + '|' + escapeRx(tdValue) + ')',
        'i'
      );
      const hasFixmeAnnotation = specContent ? fieldRx.test(specContent) : false;
      result.divergences.push({
        field,
        scenarioValue,
        testDataValue: tdValue,
        hasFixmeAnnotation,
        testDataFile: path.relative(ROOT, fp),
      });
    }
  }
  return result;
}

function escapeRx(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Detect soft-expect failures in the last parsed Playwright run.
// Looks for test-results/last-run-parsed.json and, fallback, results.json.
function collectSoftFailures() {
  const result = { checked: false, softFailuresDetected: 0, details: [], source: null };
  const parsed = path.join(OUTPUT, 'test-results', 'last-run-parsed.json');
  const rawJson = path.join(OUTPUT, 'test-results', 'results.json');
  let source = null;
  let data = null;
  if (fs.existsSync(parsed)) {
    try { data = JSON.parse(readFile(parsed) || 'null'); source = 'last-run-parsed.json'; } catch {}
  }
  if (!data && fs.existsSync(rawJson)) {
    try { data = JSON.parse(readFile(rawJson) || 'null'); source = 'results.json'; } catch {}
  }
  if (!data) {
    result.note = 'No Playwright results JSON found — soft-fail check skipped';
    return result;
  }
  result.checked = true;
  result.source = source;

  // Soft failures in Playwright JSON surface as test.results[].errors[] where the
  // outer status is 'passed' (soft assertions don't fail the test). Walk the suite
  // tree and count error entries inside passed results.
  const collectFromSuites = suites => {
    if (!Array.isArray(suites)) return;
    for (const suite of suites) {
      for (const spec of suite.specs || []) {
        for (const t of spec.tests || []) {
          for (const r of t.results || []) {
            const errs = Array.isArray(r.errors) ? r.errors : [];
            if (r.status === 'passed' && errs.length > 0) {
              result.softFailuresDetected += errs.length;
              result.details.push({
                title: spec.title,
                softErrors: errs.map(e => (e.message || '').split('\n')[0].slice(0, 200)),
              });
            }
          }
        }
      }
      collectFromSuites(suite.suites);
    }
  };
  collectFromSuites(data.suites);
  return result;
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
    const locatorsDir = isMobile
      ? path.join(OUTPUT, 'locators', 'mobile')
      : path.join(OUTPUT, 'locators');
    if (fs.existsSync(locatorsDir)) {
      fs.readdirSync(locatorsDir)
        .filter(f => f.endsWith('.locators.json'))
        .forEach(f => manifest.locatorFiles.push(path.join(locatorsDir, f)));
    }
  }
  if (manifest.pageFiles.length === 0) {
    const objectsDir = isMobile ? path.join(OUTPUT, 'screens') : path.join(OUTPUT, 'pages');
    if (fs.existsSync(objectsDir)) {
      fs.readdirSync(objectsDir)
        .filter(f => f.endsWith('.ts') && !f.endsWith('.helpers.ts'))
        .forEach(f => manifest.pageFiles.push(path.join(objectsDir, f)));
    }
  }
  if (manifest.helperFiles.length === 0) {
    const objectsDir = isMobile ? path.join(OUTPUT, 'screens') : path.join(OUTPUT, 'pages');
    if (fs.existsSync(objectsDir)) {
      fs.readdirSync(objectsDir)
        .filter(f => f.endsWith('.helpers.ts'))
        .forEach(f => manifest.helperFiles.push(path.join(objectsDir, f)));
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
      'dim3.helperStepsDrift',
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
      'dim9.testDataDivergence',
      'dim9.softFailures',
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
