#!/usr/bin/env node

/**
 * ci-test-runner.js — Cross-platform CI test runner
 *
 * Reads configuration from ci/config/ci-defaults.json for timeouts and retries.
 *
 * Usage:
 *   node ci/scripts/ci-test-runner.js --suite=smoke --browser=chrome
 *   node ci/scripts/ci-test-runner.js --suite=regression --shard=1/4
 *   node ci/scripts/ci-test-runner.js --suite=all --retries=2 --timeout=60
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..', '..');
const isWin = process.platform === 'win32';
const npxCmd = isWin ? 'npx.cmd' : 'npx';

// Parse CLI arguments
const args = {};
process.argv.slice(2).forEach(arg => {
  const match = arg.match(/^--([\w-]+)=(.+)$/);
  if (match) args[match[1]] = match[2];
});

// Load defaults from ci-defaults.json
let defaults = {};
const defaultsFile = path.join(ROOT, 'ci', 'config', 'ci-defaults.json');
if (fs.existsSync(defaultsFile)) {
  defaults = JSON.parse(fs.readFileSync(defaultsFile, 'utf-8'));
}

const suite = args.suite || 'smoke';
const browser = args.browser || (defaults.browsers?.[0] || 'chrome');
const shard = args.shard || null;
const outputDir = path.join(ROOT, 'output');

// Get suite-specific config from defaults
const suiteConfig = defaults.testSuites?.[suite] || {};
const retries = args.retries || (process.env.CI ? String(suiteConfig.retries ?? 1) : '0');
const timeoutMinutes = parseInt(args.timeout || suiteConfig.timeout || 60, 10);
const timeoutMs = timeoutMinutes * 60 * 1000;

// Build Playwright command
const parts = [
  npxCmd, 'playwright', 'test',
  `--project=${browser}`,
  `--retries=${retries}`,
  '--reporter=json,html,list',
];

// Add suite filter
const grepMap = {
  smoke: '@smoke', regression: '@regression',
  p0: '@P0', p1: '@P1',
  api: '@api', hybrid: '@hybrid',
  mobile: '@mobile',
};
if (suite !== 'all' && grepMap[suite]) {
  parts.push(`--grep=${grepMap[suite]}`);
}

// Add sharding
if (shard) {
  parts.push(`--shard=${shard}`);
}

const command = parts.join(' ');

console.log(`\n=== Agentic QE Framework v2 — CI Test Runner ===\n`);
console.log(`  Suite:    ${suite}${suiteConfig.grep ? ` (${suiteConfig.grep})` : ''}`);
console.log(`  Browser:  ${browser}`);
console.log(`  Shard:    ${shard || 'none'}`);
console.log(`  Retries:  ${retries}`);
console.log(`  Timeout:  ${timeoutMinutes} minutes`);
console.log(`  Command:  ${command}`);
console.log(`  CWD:      ${outputDir}\n`);

// Verify output directory
if (!fs.existsSync(outputDir)) {
  console.error('ERROR: output/ directory not found. Run "node setup.js" first.');
  process.exit(2);
}

// Verify package.json exists
if (!fs.existsSync(path.join(outputDir, 'package.json'))) {
  console.error('ERROR: output/package.json not found. Run "node setup.js" first.');
  process.exit(2);
}

// Run tests
try {
  execSync(command, {
    cwd: outputDir,
    stdio: 'inherit',
    env: { ...process.env },
    timeout: timeoutMs,
  });
  console.log('\nAll tests passed.');
  process.exit(0);
} catch (err) {
  if (err.killed) {
    console.error(`\nTests timed out after ${timeoutMinutes} minutes.`);
  } else {
    console.error('\nTests failed. Exit code:', err.status);
  }
  process.exit(1);
}
