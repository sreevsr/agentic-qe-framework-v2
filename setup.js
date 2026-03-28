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
  if (FLAGS.allBrowsers) console.log(`${SYMBOLS.info} Browsers: All (Chrome, Firefox, WebKit)`);
  console.log('');

  // Step 1: Validate Node.js version
  const nodeVersion = parseInt(process.version.slice(1).split('.')[0], 10);
  if (nodeVersion < 18) {
    console.error(`${SYMBOLS.fail} Node.js >= 18 required. Found: ${process.version}`);
    process.exit(1);
  }
  console.log(`${SYMBOLS.ok} Node.js version check passed`);

  // If validate-only, skip to validation
  if (FLAGS.validateOnly) {
    runValidation();
    return;
  }

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

  const checks = [
    // Output project structure
    { label: 'output/ exists',                    ok: fs.existsSync(OUTPUT) },
    ...configFileChecks,
    { label: 'output/.env exists',                 ok: fs.existsSync(path.join(OUTPUT, '.env')) },
    { label: `output/.language = ${language}`,     ok: fs.existsSync(path.join(OUTPUT, '.language')) },
    // Core framework files (language-specific)
    ...coreFileChecks,
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
    console.log(`  3. Run the Explorer-Builder agent: @QE Explorer (Copilot) or via Claude Code`);
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
