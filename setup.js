#!/usr/bin/env node

/**
 * setup.js — Cross-platform bootstrap for Agentic QE Framework v2
 *
 * Usage:
 *   node setup.js                  # Setup with Chrome only
 *   node setup.js --all-browsers   # Setup with all browsers
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const isWin = process.platform === 'win32';
const SYMBOLS = {
  ok:    isWin ? '[OK]'   : '\u2705',
  fail:  isWin ? '[FAIL]' : '\u274c',
  skip:  isWin ? '[--]'   : '\u23ed\ufe0f ',
  arrow: isWin ? '=>'     : '\u27a1\ufe0f ',
  info:  isWin ? '[i]'    : '\u2139\ufe0f ',
  warn:  isWin ? '[!]'    : '\u26a0\ufe0f ',
};

const npmCmd = isWin ? 'npm.cmd' : 'npm';
const npxCmd = isWin ? 'npx.cmd' : 'npx';

const ROOT = __dirname;
const OUTPUT = path.join(ROOT, 'output');
const TEMPLATES = path.join(ROOT, 'templates');
const TEMPLATES_CONFIG = path.join(TEMPLATES, 'config');
const TEMPLATES_CORE = path.join(TEMPLATES, 'core');

const OUTPUT_DIRS = [
  '', 'core', 'pages', 'locators',
  'tests', 'tests/web', 'tests/api', 'tests/hybrid',
  'test-data', 'test-data/shared', 'test-data/web', 'test-data/api',
  'test-data/hybrid', 'test-data/datasets',
  'screenshots', 'test-results',
  'reports', 'reports/metrics',
  'scout-reports', 'auth',
];

const CONFIG_FILES = [
  { src: 'playwright.config.ts', dest: 'playwright.config.ts' },
  { src: 'package.json',         dest: 'package.json' },
  { src: 'tsconfig.json',        dest: 'tsconfig.json' },
  { src: '.env.example',         dest: '.env.example' },
];

const CORE_FILES = [
  { src: 'base-page.ts',        dest: path.join('core', 'base-page.ts') },
  { src: 'locator-loader.ts',   dest: path.join('core', 'locator-loader.ts') },
  { src: 'test-data-loader.ts', dest: path.join('core', 'test-data-loader.ts') },
  { src: 'shared-state.ts',     dest: path.join('core', 'shared-state.ts') },
];

const validateOnly = process.argv.includes('--validate-only');

async function main() {
  console.log('\n=== Agentic QE Framework v2 — Setup ===\n');
  console.log(`${SYMBOLS.info} Platform: ${os.platform()} ${os.arch()}`);
  console.log(`${SYMBOLS.info} Node.js:  ${process.version}`);
  console.log(`${SYMBOLS.info} Root:     ${ROOT}`);
  if (validateOnly) console.log(`${SYMBOLS.info} Mode:     Validate only (no install)`);
  console.log('');

  // Step 1: Validate Node.js version
  const nodeVersion = parseInt(process.version.slice(1).split('.')[0], 10);
  if (nodeVersion < 18) {
    console.error(`${SYMBOLS.fail} Node.js >= 18 required. Found: ${process.version}`);
    process.exit(1);
  }
  console.log(`${SYMBOLS.ok} Node.js version check passed`);

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

  // Step 3: Copy template config files
  console.log(`\n${SYMBOLS.arrow} Copying template config files...`);
  for (const file of CONFIG_FILES) {
    const src = path.join(TEMPLATES_CONFIG, file.src);
    const dest = path.join(OUTPUT, file.dest);
    if (!fs.existsSync(src)) {
      console.log(`${SYMBOLS.skip} Template not found: ${file.src} (skipping)`);
      continue;
    }
    if (fs.existsSync(dest)) {
      console.log(`${SYMBOLS.skip} Already exists: ${file.dest} (skipping)`);
    } else {
      fs.copyFileSync(src, dest);
      console.log(`${SYMBOLS.ok} Copied: ${file.dest}`);
    }
  }

  // Step 4: Copy core framework files (always overwrite — framework-managed)
  console.log(`\n${SYMBOLS.arrow} Copying core framework files...`);
  for (const file of CORE_FILES) {
    const src = path.join(TEMPLATES_CORE, file.src);
    const dest = path.join(OUTPUT, file.dest);
    if (!fs.existsSync(src)) {
      console.log(`${SYMBOLS.skip} Template not found: ${file.src} (skipping)`);
      continue;
    }
    fs.copyFileSync(src, dest);
    console.log(`${SYMBOLS.ok} Copied: ${file.dest}`);
  }

  // Step 5: Create .env from .env.example
  console.log(`\n${SYMBOLS.arrow} Setting up environment...`);
  const envDest = path.join(OUTPUT, '.env');
  const envExample = path.join(OUTPUT, '.env.example');
  if (!fs.existsSync(envDest) && fs.existsSync(envExample)) {
    fs.copyFileSync(envExample, envDest);
    console.log(`${SYMBOLS.ok} Created .env from .env.example — edit with your credentials`);
  } else if (fs.existsSync(envDest)) {
    console.log(`${SYMBOLS.skip} .env already exists`);
  } else {
    console.log(`${SYMBOLS.warn} No .env.example found`);
  }

  // Step 5b: Create output/.gitignore (for node_modules inside output/)
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
    console.log(`${SYMBOLS.ok} Created output/.gitignore`);
  }

  // Step 5c: Initialize shared-state.json (for SAVE/loadState)
  const sharedStateFile = path.join(OUTPUT, 'test-data', 'shared-state.json');
  if (!fs.existsSync(sharedStateFile)) {
    fs.writeFileSync(sharedStateFile, JSON.stringify({}, null, 2));
    console.log(`${SYMBOLS.ok} Created test-data/shared-state.json`);
  }

  if (!validateOnly) {
    // Step 6: Install dependencies
    console.log(`\n${SYMBOLS.arrow} Installing dependencies in output/...`);
    try {
      execSync(`${npmCmd} install`, {
        cwd: OUTPUT, stdio: 'inherit',
        env: { ...process.env, npm_config_loglevel: 'warn' },
      });
      console.log(`${SYMBOLS.ok} Dependencies installed`);
    } catch (err) {
      console.error(`${SYMBOLS.fail} npm install failed.`);
      process.exit(1);
    }

    // Step 7: Install Playwright browsers
    const allBrowsers = process.argv.includes('--all-browsers');
    const browserArg = allBrowsers ? '' : '--with-deps chromium';
    console.log(`\n${SYMBOLS.arrow} Installing Playwright browsers${allBrowsers ? ' (all)' : ' (Chrome only)'}...`);
    try {
      execSync(`${npxCmd} playwright install ${browserArg}`.trim(), { cwd: OUTPUT, stdio: 'inherit' });
      console.log(`${SYMBOLS.ok} Playwright browsers installed`);
    } catch (err) {
      console.error(`${SYMBOLS.fail} Playwright browser install failed.`);
      process.exit(1);
    }
  } else {
    console.log(`\n${SYMBOLS.skip} Skipping npm install and browser install (validate-only mode)`);
  }

  // Step 8: Validation
  console.log('\n=== Setup Validation ===\n');
  const checks = [
    { label: 'output/ exists',                    ok: fs.existsSync(OUTPUT) },
    { label: 'output/core/ has framework files',   ok: fs.existsSync(path.join(OUTPUT, 'core', 'base-page.ts')) },
    { label: 'output/playwright.config.ts exists', ok: fs.existsSync(path.join(OUTPUT, 'playwright.config.ts')) },
    { label: 'output/package.json exists',         ok: fs.existsSync(path.join(OUTPUT, 'package.json')) },
    { label: 'output/node_modules/ exists',        ok: fs.existsSync(path.join(OUTPUT, 'node_modules')) },
    { label: 'output/.env exists',                 ok: fs.existsSync(envDest) },
    { label: 'output/tests/web/ exists',           ok: fs.existsSync(path.join(OUTPUT, 'tests', 'web')) },
    { label: 'output/tests/api/ exists',           ok: fs.existsSync(path.join(OUTPUT, 'tests', 'api')) },
    { label: 'output/tests/hybrid/ exists',        ok: fs.existsSync(path.join(OUTPUT, 'tests', 'hybrid')) },
  ];

  let passed = 0;
  for (const c of checks) {
    console.log(`  ${c.ok ? SYMBOLS.ok : SYMBOLS.fail} ${c.label}`);
    if (c.ok) passed++;
  }

  console.log(`\n${passed}/${checks.length} checks passed.`);
  if (passed === checks.length) {
    console.log(`\n${SYMBOLS.ok} Setup complete!\n`);
    console.log('Next steps:');
    console.log('  1. Edit output/.env with your credentials');
    console.log('  2. Place scenarios in scenarios/web/, scenarios/api/, or scenarios/hybrid/');
    console.log('  3. Run the Explorer-Builder agent on a scenario\n');
  } else {
    console.log(`\n${SYMBOLS.warn} Some checks failed.\n`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error(`\n${SYMBOLS.fail} Setup failed:`, err.message);
  process.exit(1);
});
