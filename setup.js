#!/usr/bin/env node

/**
 * setup.js — Cross-platform bootstrap for Agentic QE Framework v2
 *
 * Uses only built-in Node.js modules — no npm install needed to run this script.
 *
 * Usage:
 *   node setup.js                       # Setup TypeScript (default) with Chrome
 *   node setup.js --language=python     # Setup Python + pytest
 *   node setup.js --language=javascript # Setup JavaScript (no TypeScript)
 *   node setup.js --all-browsers        # Install all browsers
 *   node setup.js --validate-only       # Validate without installing
 *   node setup.js --skip-install        # Create dirs + copy files only
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

// ---------------------------------------------------------------------------
// Platform-safe symbols and commands
// ---------------------------------------------------------------------------
const isWin = process.platform === 'win32';
const SYMBOLS = {
  ok:    isWin ? '[OK]'   : '\u2705',
  fail:  isWin ? '[FAIL]' : '\u274c',
  skip:  isWin ? '[--]'   : '\u23ed\ufe0f ',
  arrow: isWin ? '=>'     : '\u27a1\ufe0f ',
  info:  isWin ? '[i]'    : '\u2139\ufe0f ',
  warn:  isWin ? '[!]'    : '\u26a0\ufe0f ',
  run:   isWin ? '[..]'   : '\u23f3',
};

const npmCmd = isWin ? 'npm.cmd' : 'npm';
const npxCmd = isWin ? 'npx.cmd' : 'npx';

// ---------------------------------------------------------------------------
// Flags
// ---------------------------------------------------------------------------
// Parse --language=<lang> argument
const langArg = process.argv.find(a => a.startsWith('--language='));
const language = langArg ? langArg.split('=')[1] : 'typescript';

const FLAGS = {
  allBrowsers: process.argv.includes('--all-browsers'),
  validateOnly: process.argv.includes('--validate-only'),
  skipInstall: process.argv.includes('--skip-install'),
  skipHooks: process.argv.includes('--skip-hooks'),
  language,
};

// Validate language
const SUPPORTED_LANGUAGES = ['typescript', 'javascript', 'python'];
if (!SUPPORTED_LANGUAGES.includes(language)) {
  console.error(`${isWin ? '[FAIL]' : '\u274c'} Unsupported language: ${language}`);
  console.error(`Supported: ${SUPPORTED_LANGUAGES.join(', ')}`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Paths (language-aware)
// ---------------------------------------------------------------------------
const ROOT = __dirname;
const OUTPUT = path.join(ROOT, 'output');
const TEMPLATES = path.join(ROOT, 'templates');

// Language-specific template directories
const LANGUAGE_CONFIG = {
  typescript: {
    configDir: path.join(TEMPLATES, 'config'),
    coreDir: path.join(TEMPLATES, 'core'),
    configFiles: [
      { src: 'playwright.config.ts', dest: 'playwright.config.ts' },
      { src: 'package.json',         dest: 'package.json' },
      { src: 'tsconfig.json',        dest: 'tsconfig.json' },
      { src: '.env.example',         dest: '.env.example' },
    ],
    coreFiles: [
      { src: 'base-page.ts',        dest: path.join('core', 'base-page.ts') },
      { src: 'locator-loader.ts',   dest: path.join('core', 'locator-loader.ts') },
      { src: 'test-data-loader.ts', dest: path.join('core', 'test-data-loader.ts') },
      { src: 'shared-state.ts',     dest: path.join('core', 'shared-state.ts') },
    ],
    installCmd: `${npmCmd} install`,
    playwrightCmd: `${npxCmd} playwright install`,
    playwrightChromeCmd: `${npxCmd} playwright install --with-deps chromium`,
  },
  javascript: {
    configDir: path.join(TEMPLATES, 'config-javascript'),
    coreDir: path.join(TEMPLATES, 'core'), // JS uses same core files — types stripped at usage
    configFiles: [
      { src: 'playwright.config.js', dest: 'playwright.config.js' },
      { src: 'package.json',         dest: 'package.json' },
      { src: '.env.example',         dest: '.env.example' },
    ],
    coreFiles: [
      { src: 'base-page.ts',        dest: path.join('core', 'base-page.js') },
      { src: 'locator-loader.ts',   dest: path.join('core', 'locator-loader.js') },
      { src: 'test-data-loader.ts', dest: path.join('core', 'test-data-loader.js') },
      { src: 'shared-state.ts',     dest: path.join('core', 'shared-state.js') },
    ],
    installCmd: `${npmCmd} install`,
    playwrightCmd: `${npxCmd} playwright install`,
    playwrightChromeCmd: `${npxCmd} playwright install --with-deps chromium`,
    note: 'JavaScript uses TypeScript core files renamed to .js — the LLM generates JS code without types.',
  },
  python: {
    configDir: path.join(TEMPLATES, 'config-python'),
    coreDir: path.join(TEMPLATES, 'core-python'),
    configFiles: [
      { src: 'conftest.py',       dest: 'conftest.py' },
      { src: 'pytest.ini',        dest: 'pytest.ini' },
      { src: 'requirements.txt',  dest: 'requirements.txt' },
      { src: '.env.example',      dest: '.env.example' },
    ],
    coreFiles: [
      { src: 'base_page.py',        dest: path.join('core', 'base_page.py') },
      { src: 'locator_loader.py',   dest: path.join('core', 'locator_loader.py') },
      { src: 'test_data_loader.py', dest: path.join('core', 'test_data_loader.py') },
      { src: 'shared_state.py',     dest: path.join('core', 'shared_state.py') },
      { src: '__init__.py',          dest: path.join('core', '__init__.py') },
    ],
    installCmd: `${isWin ? 'pip' : 'pip3'} install -r requirements.txt`,
    playwrightCmd: 'playwright install',
    playwrightChromeCmd: 'playwright install chromium',
  },
};

const langConfig = LANGUAGE_CONFIG[language];
const TEMPLATES_CONFIG = langConfig.configDir;
const TEMPLATES_CORE = langConfig.coreDir;
const CONFIG_FILES = langConfig.configFiles;
const CORE_FILES = langConfig.coreFiles;

// ---------------------------------------------------------------------------
// Output directory structure (same for all languages)
// ---------------------------------------------------------------------------
const OUTPUT_DIRS = [
  '', 'core', 'pages', 'locators',
  'tests', 'tests/web', 'tests/api', 'tests/hybrid',
  'test-data', 'test-data/shared', 'test-data/web', 'test-data/api',
  'test-data/hybrid', 'test-data/datasets',
  'screenshots', 'test-results',
  'reports', 'reports/metrics',
  'scout-reports', 'auth',
  // Framework-level utilities (csv-grid compare, grid row collectors, etc.) — see UTILS_FILES
  'utils',
  // Mobile (WDIO + Appium) — added for mobile feature parity v1.0
  'screens', 'tests/mobile', 'test-data/mobile', 'locators/mobile',
];

// ---------------------------------------------------------------------------
// Mobile template files (TypeScript only — mobile is WDIO + Appium)
// Copied in addition to the language-specific config/core files when language === 'typescript'.
// ---------------------------------------------------------------------------
const MOBILE_CONFIG_FILES = [
  { src: 'wdio.conf.ts',   dest: 'wdio.conf.ts' },
  { src: 'capabilities.ts', dest: path.join('core', 'capabilities.ts') },
];

const MOBILE_CORE_FILES = [
  { src: 'base-screen.ts',          dest: path.join('core', 'base-screen.ts') },
  { src: 'mobile-locator-loader.ts', dest: path.join('core', 'mobile-locator-loader.ts') },
  { src: 'popup-guard.ts',           dest: path.join('core', 'popup-guard.ts') },
  { src: 'wdio-step.ts',             dest: path.join('core', 'wdio-step.ts') },
  { src: 'wdio-types.d.ts',          dest: path.join('core', 'wdio-types.d.ts') },
];

// ---------------------------------------------------------------------------
// Framework-level utility files (TypeScript only).
// Pure helpers + Playwright integrations that are shared across all apps (not
// per-scenario, not per-page). Always overwritten during setup — framework-managed,
// not user-edited. Lives in output/utils/. Consumers: helpers in output/pages/{app}/*.helpers.ts.
// ---------------------------------------------------------------------------
const UTILS_FILES = [
  { src: 'csv-grid-compare.ts',   dest: path.join('utils', 'csv-grid-compare.ts') },
  { src: 'grid-row-collector.ts', dest: path.join('utils', 'grid-row-collector.ts') },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function runCommand(cmd, cwd, label) {
  console.log(`  ${SYMBOLS.run} ${label}...`);
  try {
    execSync(cmd, {
      cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 300000, // 5 min max
    });
    console.log(`  ${SYMBOLS.ok} ${label}`);
    return true;
  } catch (err) {
    console.error(`  ${SYMBOLS.fail} ${label} — failed`);
    if (err.stderr) {
      const firstLine = err.stderr.toString().trim().split('\n')[0];
      if (firstLine) console.error(`      ${firstLine}`);
    }
    return false;
  }
}

// ---------------------------------------------------------------------------
// Strip // and /* */ comments from JSONC so JSON.parse can read it.
// String-aware: comment markers inside "..." values are left alone, so
// URLs like "https://..." survive intact.
// ---------------------------------------------------------------------------
function stripJsonComments(text) {
  let out = '';
  let inString = false, inSingle = false, inMulti = false, escaped = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i], n = text[i + 1];
    if (inSingle) { if (c === '\n') { inSingle = false; out += c; } continue; }
    if (inMulti)  { if (c === '*' && n === '/') { inMulti = false; i++; } continue; }
    if (inString) {
      out += c;
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') { inString = true; out += c; continue; }
    if (c === '/' && n === '/') { inSingle = true; i++; continue; }
    if (c === '/' && n === '*') { inMulti = true; i++; continue; }
    out += c;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Install pre-commit hook for rule-sync-check drift detection.
// - Skipped on --skip-hooks
// - Skipped silently if not a git repo (zip download, etc.)
// - Idempotent: re-running setup just re-confirms core.hooksPath
// ---------------------------------------------------------------------------
function installGitHooks() {
  if (FLAGS.skipHooks) {
    console.log(`${SYMBOLS.info} --skip-hooks: pre-commit hook install skipped`);
    return;
  }

  // Detect git repo (silent on failure)
  try {
    execSync('git rev-parse --git-dir', { cwd: ROOT, stdio: 'pipe' });
  } catch {
    console.log(`${SYMBOLS.info} Not a git repo — skipping pre-commit hook install`);
    return;
  }

  const hookPath = path.join(ROOT, '.githooks', 'pre-commit');
  if (!fs.existsSync(hookPath)) {
    console.log(`${SYMBOLS.warn} .githooks/pre-commit missing — skipping hook install`);
    return;
  }

  // Configure git to use .githooks (idempotent — running twice is a no-op)
  try {
    execSync('git config core.hooksPath .githooks', { cwd: ROOT, stdio: 'pipe' });
  } catch (err) {
    console.log(`${SYMBOLS.warn} Could not set core.hooksPath: ${err.message}`);
    return;
  }

  // Ensure executable bit on Linux/macOS (Windows ignores file modes)
  if (!isWin) {
    try {
      fs.chmodSync(hookPath, 0o755);
    } catch {
      // best effort — not fatal
    }
  }

  console.log(`${SYMBOLS.ok} Pre-commit hook installed (.githooks/pre-commit → npm run rule-sync-check)`);
}

// ---------------------------------------------------------------------------
// Install the Chromium build used by the Playwright MCP server.
//
// The Explorer drives a browser through @playwright/mcp, whose bundled
// Playwright is independent of output/'s @playwright/test. Step 7 installs
// output/'s browser (for the Executor); this installs the MCP's browser
// (for the Explorer). When the two Playwright versions differ, the Explorer
// fails with "no chrome browser" unless this runs.
//
// The MCP version is read straight from .vscode/mcp.json (the file VS Code
// actually launches), so there is ONE source of truth: pin the version
// there, re-run setup, and the browser follows automatically.
//
// Non-fatal: a failure here only affects web/hybrid Explorer runs.
// ---------------------------------------------------------------------------
function installMcpBrowser() {
  console.log(`\n${SYMBOLS.arrow} Installing Playwright MCP browser (for the Explorer)...`);

  // Prefer the live local config; fall back to the committed template.
  const candidates = [
    path.join(ROOT, '.vscode', 'mcp.json'),
    path.join(ROOT, '.vscode', 'mcp.example.json'),
  ];
  const mcpFile = candidates.find(f => fs.existsSync(f));
  if (!mcpFile) {
    console.log(`  ${SYMBOLS.skip} No .vscode/mcp.json or mcp.example.json — skipping MCP browser install`);
    return;
  }

  // mcp.json is JSONC (// and /* */ comments), so extract the pinned package
  // spec by regex. The quote must sit immediately before @playwright/mcp, so
  // prose mentioning the package inside a "$comment" string never matches.
  let mcpText;
  try {
    mcpText = fs.readFileSync(mcpFile, 'utf8');
  } catch (e) {
    console.log(`  ${SYMBOLS.warn} Could not read ${path.basename(mcpFile)}: ${e.message} — skipping`);
    return;
  }
  const match = mcpText.match(/"(@playwright\/mcp@[^"\s]+)"/);
  if (!match) {
    console.log(`  ${SYMBOLS.skip} No pinned @playwright/mcp@<version> in ${path.basename(mcpFile)} — skipping`);
    console.log(`  ${SYMBOLS.info} (Playwright MCP server may be commented out — expected for api/mobile-only setups)`);
    return;
  }
  const mcpSpec = match[1];

  // `npx -y` auto-confirms the package download; `install-browser
  // chrome-for-testing` fetches the Chromium build the MCP's `--browser
  // chromium` server uses. This is the command proven in Explorer logs.
  const cmd = `${npxCmd} -y ${mcpSpec} install-browser chrome-for-testing`;
  if (runCommand(cmd, ROOT, `Playwright MCP browser install (${mcpSpec})`)) {
    return;
  }
  // Non-fatal — warn loudly so the cause is visible if the Explorer later fails.
  console.log(`  ${SYMBOLS.warn} MCP browser install failed. Web/hybrid Explorer runs may`);
  console.log(`     fail with "no chrome browser". Re-run manually with:`);
  console.log(`         npx -y ${mcpSpec} install-browser chrome-for-testing`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log('\n=== Agentic QE Framework v2 — Setup ===\n');
  console.log(`${SYMBOLS.info} Platform: ${os.platform()} ${os.arch()}`);
  console.log(`${SYMBOLS.info} Node.js:  ${process.version}`);
  console.log(`${SYMBOLS.info} Root:     ${ROOT}`);
  console.log(`${SYMBOLS.info} Language: ${language}`);
  if (FLAGS.validateOnly) console.log(`${SYMBOLS.info} Mode:     Validate only (no install)`);
  if (FLAGS.skipInstall) console.log(`${SYMBOLS.info} Mode:     Skip install (dirs + files only)`);
  if (FLAGS.skipHooks) console.log(`${SYMBOLS.info} Mode:     Skip git hook install`);
  if (FLAGS.allBrowsers) console.log(`${SYMBOLS.info} Browsers: All (Chrome, Firefox, WebKit)`);
  console.log('');

  // Step 1: Validate Node.js version
  const nodeVersion = parseInt(process.version.slice(1).split('.')[0], 10);
  if (nodeVersion < 18) {
    console.error(`${SYMBOLS.fail} Node.js >= 18 required. Found: ${process.version}`);
    process.exit(1);
  }
  console.log(`${SYMBOLS.ok} Node.js version check passed`);

  // Git check — required by `npm install` of Appium MCP server (transitive deps use git URLs)
  // Non-fatal: warn loudly so the user sees it before the agent fails mysteriously, but
  // don't block setup since git is only required for mobile MCP, not for web automation.
  try {
    execSync('git --version', { stdio: 'pipe' });
    console.log(`${SYMBOLS.ok} Git found on PATH`);
  } catch {
    console.log('');
    console.log(`${SYMBOLS.warn} Git not found on PATH.`);
    console.log(`     Required by 'npm install' of the Appium MCP server (some transitive`);
    console.log(`     dependencies are fetched via git+ssh; npm shells out to 'git' during install).`);
    console.log(`     Mobile/mobile-hybrid scenarios will fail at MCP startup with`);
    console.log(`     'npm error spawn git ENOENT' until git is installed.`);
    if (isWin) {
      console.log(`     Install Git for Windows: https://git-scm.com/download/win`);
    } else if (process.platform === 'darwin') {
      console.log(`     Install via: brew install git  (or 'xcode-select --install')`);
    } else {
      console.log(`     Install via your package manager (e.g. 'sudo apt install git').`);
    }
    console.log(`     Web/api/hybrid scenarios are unaffected — proceeding with setup.`);
    console.log('');
  }

  // If validate-only, skip to validation
  if (FLAGS.validateOnly) {
    runValidation();
    return;
  }

  // Step 1.5: Install git pre-commit hook (rule-sync-check drift detection)
  installGitHooks();

  // Step 2: Create output directory structure
  console.log(`\n${SYMBOLS.arrow} Creating output/ directory structure...`);
  let dirsCreated = 0;
  for (const dir of OUTPUT_DIRS) {
    const fullPath = path.join(OUTPUT, dir);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
      dirsCreated++;
    }
  }
  console.log(`${SYMBOLS.ok} ${dirsCreated} directories created (${OUTPUT_DIRS.length - dirsCreated} already existed)`);

  // Step 3: Copy template config files (skip if already exist — user may have customized)
  console.log(`\n${SYMBOLS.arrow} Copying template config files...`);
  for (const file of CONFIG_FILES) {
    const src = path.join(TEMPLATES_CONFIG, file.src);
    const dest = path.join(OUTPUT, file.dest);
    if (!fs.existsSync(src)) {
      console.log(`  ${SYMBOLS.skip} Template not found: ${file.src} (skipping)`);
      continue;
    }
    if (fs.existsSync(dest)) {
      console.log(`  ${SYMBOLS.skip} Already exists: ${file.dest} (skipping — will not overwrite user config)`);
    } else {
      fs.copyFileSync(src, dest);
      console.log(`  ${SYMBOLS.ok} Copied: ${file.dest}`);
    }
  }

  // Step 4: Copy core framework files (always overwrite — framework-managed, not user-editable)
  console.log(`\n${SYMBOLS.arrow} Copying core framework files (always overwrite — framework-managed)...`);
  for (const file of CORE_FILES) {
    const src = path.join(TEMPLATES_CORE, file.src);
    const dest = path.join(OUTPUT, file.dest);
    if (!fs.existsSync(src)) {
      console.log(`  ${SYMBOLS.skip} Template not found: ${file.src} (skipping)`);
      continue;
    }
    const existed = fs.existsSync(dest);
    fs.copyFileSync(src, dest);
    console.log(`  ${SYMBOLS.ok} Copied: ${file.dest}${existed ? ' (overwritten)' : ''}`);
  }

  // Step 4a: Copy framework utility templates (TypeScript only)
  // Always overwritten — these are framework-managed pure helpers used by team-owned
  // page helpers (output/pages/{app}/*.helpers.ts).
  if (language === 'typescript') {
    const UTILS_DIR = path.join(TEMPLATES, 'utils');
    if (fs.existsSync(UTILS_DIR)) {
      console.log(`\n${SYMBOLS.arrow} Copying framework utility files (always overwrite — framework-managed)...`);
      for (const file of UTILS_FILES) {
        const src = path.join(UTILS_DIR, file.src);
        const dest = path.join(OUTPUT, file.dest);
        if (!fs.existsSync(src)) {
          console.log(`  ${SYMBOLS.skip} Utils template not found: ${file.src} (skipping)`);
          continue;
        }
        const existed = fs.existsSync(dest);
        fs.copyFileSync(src, dest);
        console.log(`  ${SYMBOLS.ok} Copied: ${file.dest}${existed ? ' (overwritten)' : ''}`);
      }
    } else {
      console.log(`\n${SYMBOLS.skip} Utils template directory not found (templates/utils/) — skipping utils setup`);
    }
  }

  // Step 4b: Copy mobile templates (TypeScript only — WDIO + Appium support)
  // Mobile config files (wdio.conf.ts, capabilities.ts) skip if exist (user-customized).
  // Mobile core files (base-screen, mobile-locator-loader, popup-guard) always overwrite.
  if (language === 'typescript') {
    const MOBILE_CONFIG_DIR = path.join(TEMPLATES, 'config-mobile');
    const MOBILE_CORE_DIR = path.join(TEMPLATES, 'core-mobile');

    if (fs.existsSync(MOBILE_CONFIG_DIR) && fs.existsSync(MOBILE_CORE_DIR)) {
      console.log(`\n${SYMBOLS.arrow} Copying mobile templates (WDIO + Appium)...`);

      for (const file of MOBILE_CONFIG_FILES) {
        const src = path.join(MOBILE_CONFIG_DIR, file.src);
        const dest = path.join(OUTPUT, file.dest);
        if (!fs.existsSync(src)) {
          console.log(`  ${SYMBOLS.skip} Mobile template not found: ${file.src} (skipping)`);
          continue;
        }
        if (fs.existsSync(dest)) {
          console.log(`  ${SYMBOLS.skip} Already exists: ${file.dest} (skipping — will not overwrite user config)`);
        } else {
          fs.copyFileSync(src, dest);
          console.log(`  ${SYMBOLS.ok} Copied: ${file.dest}`);
        }
      }

      for (const file of MOBILE_CORE_FILES) {
        const src = path.join(MOBILE_CORE_DIR, file.src);
        const dest = path.join(OUTPUT, file.dest);
        if (!fs.existsSync(src)) {
          console.log(`  ${SYMBOLS.skip} Mobile template not found: ${file.src} (skipping)`);
          continue;
        }
        const existed = fs.existsSync(dest);
        fs.copyFileSync(src, dest);
        console.log(`  ${SYMBOLS.ok} Copied: ${file.dest}${existed ? ' (overwritten)' : ''}`);
      }
    } else {
      console.log(`\n${SYMBOLS.skip} Mobile template directories not found (templates/config-mobile/, templates/core-mobile/) — skipping mobile setup`);
    }
  }

  // Step 5: Create .env from .env.example
  console.log(`\n${SYMBOLS.arrow} Setting up environment...`);
  const envDest = path.join(OUTPUT, '.env');
  const envExample = path.join(OUTPUT, '.env.example');
  if (!fs.existsSync(envDest)) {
    if (fs.existsSync(envExample)) {
      fs.copyFileSync(envExample, envDest);
      console.log(`  ${SYMBOLS.ok} Created .env from .env.example — edit with your credentials`);
    } else {
      // Fallback: create minimal .env even without .env.example
      const defaultEnv = [
        '# Edit with your application credentials',
        '# IMPORTANT: Quote values containing # or special chars: PASSWORD="my#secret"',
        'BASE_URL=https://your-app-url.com',
        'TEST_USERNAME=your-test-username',
        'TEST_PASSWORD="your-test-password"',
        '',
      ].join('\n');
      fs.writeFileSync(envDest, defaultEnv);
      console.log(`  ${SYMBOLS.ok} Created .env with defaults — edit with your credentials`);
    }
  } else {
    console.log(`  ${SYMBOLS.skip} .env already exists`);
  }

  // Step 5b: Create output/.gitignore
  const outputGitignore = path.join(OUTPUT, '.gitignore');
  if (!fs.existsSync(outputGitignore)) {
    fs.writeFileSync(outputGitignore, [
      'node_modules/',
      '.env',
      'test-results/',
      'playwright-report/',
      'blob-report/',
      'screenshots/',
      '',
    ].join('\n'));
    console.log(`  ${SYMBOLS.ok} Created output/.gitignore`);
  }

  // Step 5c: Initialize shared-state.json
  const sharedStateFile = path.join(OUTPUT, 'test-data', 'shared-state.json');
  if (!fs.existsSync(sharedStateFile)) {
    fs.writeFileSync(sharedStateFile, JSON.stringify({}, null, 2));
    console.log(`  ${SYMBOLS.ok} Created test-data/shared-state.json`);
  }

  // Write language marker file (tells agents which language was chosen)
  fs.writeFileSync(path.join(OUTPUT, '.language'), language);
  console.log(`  ${SYMBOLS.ok} Language marker: ${language}`);

  // Step 5d: Check VS Code MCP server config.
  // nvm/fnm/volta users: VS Code may not see the node binary on PATH, so the
  // Playwright MCP server needs an explicit npx path + PATH env. We do NOT
  // rewrite mcp.json automatically — it is JSONC with hand-written comments
  // (e.g. the disabled appium-mcp block) that a JSON.stringify round-trip
  // would silently destroy. Instead we print the snippet to add by hand.
  console.log(`\n${SYMBOLS.arrow} Checking VS Code MCP server config...`);
  const mcpJsonPath = path.join(ROOT, '.vscode', 'mcp.json');
  if (!fs.existsSync(mcpJsonPath)) {
    console.log(`  ${SYMBOLS.skip} .vscode/mcp.json not found — copy .vscode/mcp.example.json to .vscode/mcp.json`);
  } else {
    const nodeBinDir = path.dirname(process.execPath);
    const isNvm = nodeBinDir.includes('.nvm') || nodeBinDir.includes('fnm') || nodeBinDir.includes('volta');
    if (!isNvm) {
      console.log(`  ${SYMBOLS.ok} System-installed node detected — no MCP path config needed`);
    } else {
      let alreadyPatched = false;
      try {
        const mcpConfig = JSON.parse(stripJsonComments(fs.readFileSync(mcpJsonPath, 'utf8')));
        const pw = mcpConfig.servers && mcpConfig.servers.playwright;
        alreadyPatched = !!(pw && pw.env && pw.env.PATH);
      } catch (e) {
        console.log(`  ${SYMBOLS.warn} Could not parse .vscode/mcp.json: ${e.message}`);
      }
      if (alreadyPatched) {
        console.log(`  ${SYMBOLS.ok} .vscode/mcp.json already has env.PATH configured`);
      } else {
        const npxPath = path.join(nodeBinDir, isWin ? 'npx.cmd' : 'npx');
        const pathVal = `${nodeBinDir}${isWin ? ';' : ':'}\${env:PATH}`;
        console.log(`  ${SYMBOLS.warn} Node is managed by nvm/fnm/volta — VS Code needs an explicit path.`);
        console.log(`     Edit .vscode/mcp.json -> servers.playwright and add these two keys:`);
        console.log(`         "command": ${JSON.stringify(npxPath)},`);
        console.log(`         "env": { "PATH": ${JSON.stringify(pathVal)} }`);
      }
    }
  }

  if (!FLAGS.skipInstall) {
    // Step 6: Install dependencies (language-specific)
    console.log(`\n${SYMBOLS.arrow} Installing ${language} dependencies in output/...`);

    if (language === 'python') {
      // Python: pip install
      const reqFile = path.join(OUTPUT, 'requirements.txt');
      if (!fs.existsSync(reqFile)) {
        console.error(`  ${SYMBOLS.fail} requirements.txt not found`);
        process.exit(1);
      }
      if (!runCommand(langConfig.installCmd, OUTPUT, `pip install -r requirements.txt`)) {
        process.exit(1);
      }
    } else {
      // TypeScript/JavaScript: npm install
      const nodeModules = path.join(OUTPUT, 'node_modules');
      const playwrightPkg = path.join(nodeModules, '@playwright', 'test');
      if (fs.existsSync(playwrightPkg)) {
        console.log(`  ${SYMBOLS.skip} node_modules/ already installed`);
      } else {
        if (fs.existsSync(nodeModules)) {
          console.log(`  ${SYMBOLS.warn} node_modules/ appears incomplete — reinstalling...`);
        }
        if (!runCommand(langConfig.installCmd, OUTPUT, 'npm install')) {
          process.exit(1);
        }
      }
    }

    // Step 7: Install Playwright browsers (language-specific command)
    const playwrightInstallCmd = FLAGS.allBrowsers
      ? langConfig.playwrightCmd
      : langConfig.playwrightChromeCmd;
    console.log(`\n${SYMBOLS.arrow} Installing Playwright browsers${FLAGS.allBrowsers ? ' (all)' : ' (Chrome only)'}...`);
    if (!runCommand(playwrightInstallCmd, OUTPUT, 'Playwright browser install')) {
      process.exit(1);
    }

    // Step 7b: Install the browser for the Playwright MCP server (Explorer).
    // Separate from Step 7 — the MCP bundles its own Playwright version.
    installMcpBrowser();
  } else {
    console.log(`\n${SYMBOLS.skip} Skipping dependency and browser install (--skip-install mode)`);
  }

  // Step 8: Validation
  runValidation();
}

function runValidation() {
  console.log('\n=== Setup Validation ===\n');

  const skipInstallChecks = FLAGS.validateOnly || FLAGS.skipInstall;

  // Build validation checks based on language
  const coreFileChecks = CORE_FILES.map(f => ({
    label: `output/${f.dest}`, ok: fs.existsSync(path.join(OUTPUT, f.dest))
  }));
  const configFileChecks = CONFIG_FILES.filter(f => f.dest !== '.env.example').map(f => ({
    label: `output/${f.dest}`, ok: fs.existsSync(path.join(OUTPUT, f.dest))
  }));
  // Utils file checks (TypeScript only — Python/JavaScript don't use these yet)
  const utilsFileChecks = language === 'typescript'
    ? UTILS_FILES.map(f => ({
        label: `output/${f.dest}`, ok: fs.existsSync(path.join(OUTPUT, f.dest))
      }))
    : [];

  const checks = [
    // Output project structure
    { label: 'output/ exists',                    ok: fs.existsSync(OUTPUT) },
    ...configFileChecks,
    { label: 'output/.env exists',                 ok: fs.existsSync(path.join(OUTPUT, '.env')) },
    { label: `output/.language = ${language}`,     ok: fs.existsSync(path.join(OUTPUT, '.language')) },
    // Core framework files (language-specific)
    ...coreFileChecks,
    // Framework utility files (TypeScript only)
    ...utilsFileChecks,
    // Test directories
    { label: 'output/tests/web/',                  ok: fs.existsSync(path.join(OUTPUT, 'tests', 'web')) },
    { label: 'output/tests/api/',                  ok: fs.existsSync(path.join(OUTPUT, 'tests', 'api')) },
    { label: 'output/tests/hybrid/',               ok: fs.existsSync(path.join(OUTPUT, 'tests', 'hybrid')) },
    { label: 'output/test-data/shared/',           ok: fs.existsSync(path.join(OUTPUT, 'test-data', 'shared')) },
    // Dependencies (skip if validate-only or skip-install)
    ...(!skipInstallChecks ? [
      { label: 'output/node_modules/',             ok: fs.existsSync(path.join(OUTPUT, 'node_modules')) },
    ] : []),
    // Framework directories (verify framework itself is intact)
    { label: '.github/agents/ (Copilot wrappers)', ok: fs.existsSync(path.join(ROOT, '.github', 'agents')) },
    { label: 'agents/core/ (agent instructions)',   ok: fs.existsSync(path.join(ROOT, 'agents', 'core')) },
    { label: 'agents/shared/ (keyword-ref, guardrails)', ok: fs.existsSync(path.join(ROOT, 'agents', 'shared')) },
    { label: 'skills/ (skills registry)',           ok: fs.existsSync(path.join(ROOT, 'skills')) },
    { label: 'scripts/ (utility scripts)',          ok: fs.existsSync(path.join(ROOT, 'scripts')) },
    { label: 'templates/ (source of truth)',        ok: fs.existsSync(path.join(ROOT, 'templates')) },
    { label: 'scenarios/ (test scenarios)',          ok: fs.existsSync(path.join(ROOT, 'scenarios')) },
  ];

  let passed = 0;
  let failed = 0;
  for (const c of checks) {
    console.log(`  ${c.ok ? SYMBOLS.ok : SYMBOLS.fail} ${c.label}`);
    if (c.ok) passed++;
    else failed++;
  }

  console.log(`\n${passed}/${checks.length} checks passed.`);

  if (failed === 0) {
    console.log(`\n${SYMBOLS.ok} Setup complete! (language: ${language})\n`);
    console.log('Next steps:');
    console.log('  1. Edit output/.env with your application credentials');
    console.log('  2. Place scenarios in scenarios/web/, scenarios/api/, or scenarios/hybrid/');
    console.log(`  3. Run the Explorer/Builder agent: @QE Explorer (Copilot) or via Claude Code`);
    console.log(`     The agent will generate ${language} code based on the language profile.`);
    console.log('');
  } else {
    console.log(`\n${SYMBOLS.warn} ${failed} check(s) failed. Review the items above.\n`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error(`\n${SYMBOLS.fail} Setup failed:`, err.message);
  process.exit(1);
});
