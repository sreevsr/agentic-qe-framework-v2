#!/usr/bin/env node

/**
 * ci-test-runner.js — Cross-platform CI test runner
 *
 * Usage:
 *   node ci/scripts/ci-test-runner.js --suite=smoke --browser=chrome
 *   node ci/scripts/ci-test-runner.js --suite=regression --shard=1/4
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const isWin = process.platform === 'win32';
const npxCmd = isWin ? 'npx.cmd' : 'npx';

const args = {};
process.argv.slice(2).forEach(arg => {
  const match = arg.match(/^--([\w-]+)=(.+)$/);
  if (match) args[match[1]] = match[2];
});

const suite = args.suite || 'smoke';
const browser = args.browser || 'chrome';
const shard = args.shard || null;
const retries = args.retries || (process.env.CI ? '1' : '0');
const outputDir = path.resolve(__dirname, '..', '..', 'output');

const parts = [npxCmd, 'playwright', 'test', `--project=${browser}`, `--retries=${retries}`, '--reporter=json,html,list'];

const grepMap = { smoke: '@smoke', regression: '@regression', p0: '@P0', p1: '@P1', api: '@api', hybrid: '@hybrid' };
if (suite !== 'all' && grepMap[suite]) parts.push(`--grep=${grepMap[suite]}`);
if (shard) parts.push(`--shard=${shard}`);

const command = parts.join(' ');
console.log(`\n=== CI Test Runner ===`);
console.log(`Suite: ${suite} | Browser: ${browser} | Shard: ${shard || 'none'}\n`);

if (!fs.existsSync(outputDir)) { console.error('output/ not found. Run "node setup.js" first.'); process.exit(2); }

try {
  execSync(command, { cwd: outputDir, stdio: 'inherit', env: { ...process.env } });
  process.exit(0);
} catch (err) {
  console.error('\nTests failed. Exit code:', err.status);
  process.exit(1);
}
