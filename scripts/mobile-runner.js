#!/usr/bin/env node

/**
 * mobile-runner.js — Wrapper script that owns long-running mobile test execution
 *
 * DESIGN PRINCIPLE: Decouple the agent from runCommand's broken long-command
 * handshake. The runner spawns wdio, streams output to disk, classifies the
 * result into a deterministic status, and writes an atomic marker file. The
 * agent polls for the marker — every poll is a fast `ls` that the runCommand
 * notification handshake handles correctly.
 *
 * Spec: docs/mobile-executor-redesign-spec.md (Phase 1, Step 1)
 *
 * Usage:
 *   node scripts/mobile-runner.js --scenario=<name> --platform=<android|ios> --cycle=<N> [--folder=<sub>]
 *
 * Always exits 0 — status lives in the marker. Agent reads the marker, not
 * the exit code.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');
const os = require('os');
const { spawn, spawnSync } = require('child_process');

const RUNNER_VERSION = '1.0.0';
const SCHEMA_VERSION = '1.0';

// ---------------------------------------------------------------------------
// Path resolution
// ---------------------------------------------------------------------------
const PROJECT_ROOT = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.join(PROJECT_ROOT, 'output');
const TEST_RESULTS_DIR = path.join(OUTPUT_DIR, 'test-results');

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------
function parseArgs() {
  const out = {};
  for (const arg of process.argv.slice(2)) {
    const m = arg.match(/^--([\w-]+)(?:=(.+))?$/);
    if (m) out[m[1]] = m[2] === undefined ? 'true' : m[2];
  }
  return out;
}

const args = parseArgs();

if (args.help || args.h) {
  console.log('Usage: node scripts/mobile-runner.js --scenario=<name> --platform=<android|ios> --cycle=<N> [--folder=<sub>]');
  console.log('');
  console.log('Always exits 0. Status is written to output/test-results/cycle{N}-done.json');
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Config loader (framework-config.json + defaults)
// ---------------------------------------------------------------------------
function loadConfig() {
  const defaults = {
    runner: {
      maxRunDurationMs: 1200000,
      cleanupOnCycle1: true,
      tailLines: 200,
    },
    target: {
      headless: false,
      cleanupOnExit: true,
      resetOnInfraFailure: true,
      emulatorBootTimeoutMs: 90000,
      simulatorBootTimeoutMs: 30000,
      useSnapshotForEmulator: false,
    },
    appium: {
      url: 'http://localhost:4723',
      autoStart: true,
      startupTimeoutMs: 30000,
      cleanupOnExit: false,
    },
  };

  const cfgPath = path.join(PROJECT_ROOT, 'framework-config.json');
  if (!fs.existsSync(cfgPath)) return defaults;

  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(cfgPath, 'utf-8'));
  } catch {
    return defaults;
  }

  const m = raw.mobile || {};
  // Merge per-block — spec keys take precedence over defaults; legacy keys
  // (appiumHost / appiumPort) feed the appium.url default if no new url is set.
  const merged = {
    runner: { ...defaults.runner, ...(m.runner || {}) },
    target: { ...defaults.target, ...(m.target || {}) },
    appium: { ...defaults.appium, ...(m.appium || {}) },
  };

  if (!m.appium?.url && (m.appiumHost || m.appiumPort)) {
    const host = m.appiumHost || 'localhost';
    const port = m.appiumPort || 4723;
    merged.appium.url = `http://${host}:${port}`;
  }

  return merged;
}

// ---------------------------------------------------------------------------
// Marker writing — atomic .tmp → rename. Always emitted, even on RUNNER_CRASH.
// ---------------------------------------------------------------------------
function ensureTestResultsDir() {
  if (!fs.existsSync(TEST_RESULTS_DIR)) {
    fs.mkdirSync(TEST_RESULTS_DIR, { recursive: true });
  }
}

function writeMarkerAtomic(cycle, marker) {
  ensureTestResultsDir();
  const finalPath = path.join(TEST_RESULTS_DIR, `cycle${cycle}-done.json`);
  const tmpPath = `${finalPath}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(marker, null, 2));
  fs.renameSync(tmpPath, finalPath);
  return finalPath;
}

function exitWithMarker(cycle, marker) {
  try {
    const finalPath = writeMarkerAtomic(cycle, marker);
    console.log(`[mobile-runner] Marker written: ${path.relative(PROJECT_ROOT, finalPath)}`);
    console.log(`[mobile-runner] Status: ${marker.status}`);
    if (marker.failureReason) console.log(`[mobile-runner] Reason: ${marker.failureReason}`);
  } catch (err) {
    console.error(`[mobile-runner] FATAL: could not write marker: ${err.message}`);
  }
  // Spec §4.1.16: always exit 0 — status lives in the marker.
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Cross-platform process tree kill
// ---------------------------------------------------------------------------
function killProcessTree(child) {
  if (!child || child.killed || child.exitCode !== null) return;
  try {
    if (process.platform === 'win32') {
      spawnSync('taskkill', ['/F', '/T', '/PID', String(child.pid)], { stdio: 'ignore' });
    } else {
      // Spawned with detached:true so child.pid is the group leader.
      try { process.kill(-child.pid, 'SIGTERM'); } catch { /* group may have exited */ }
      // Escalate after grace period
      setTimeout(() => {
        try { process.kill(-child.pid, 'SIGKILL'); } catch { /* already dead */ }
      }, 3000).unref();
    }
  } catch {
    // best-effort; nothing to do if it fails
  }
}

// ---------------------------------------------------------------------------
// Appium HTTP probe
// ---------------------------------------------------------------------------
function appiumStatus(url, timeoutMs = 2000) {
  return new Promise((resolve) => {
    const u = new URL(`${url.replace(/\/$/, '')}/status`);
    const req = http.get({ hostname: u.hostname, port: u.port, path: u.pathname, timeout: timeoutMs }, (res) => {
      let body = '';
      res.on('data', (c) => (body += c.toString()));
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(body); } catch { /* not JSON */ }
        const isAppium = !!(json && (json.value || json.sessionId !== undefined || json.status !== undefined));
        resolve({ ok: res.statusCode === 200 && isAppium, statusCode: res.statusCode, body: body.slice(0, 200), isAppium });
      });
    });
    req.on('error', () => resolve({ ok: false, error: 'no_response' }));
    req.on('timeout', () => { req.destroy(); resolve({ ok: false, error: 'timeout' }); });
  });
}

async function waitForAppium(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const s = await appiumStatus(url, 2000);
    if (s.ok) return true;
    await sleep(1000);
  }
  return false;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// Cleanup gate — wipe test-results/* on cycle 1
// ---------------------------------------------------------------------------
function cleanupGate(cycle, cfg) {
  if (cycle !== 1 || !cfg.runner.cleanupOnCycle1) return;
  if (!fs.existsSync(TEST_RESULTS_DIR)) {
    fs.mkdirSync(TEST_RESULTS_DIR, { recursive: true });
    return;
  }
  for (const entry of fs.readdirSync(TEST_RESULTS_DIR)) {
    const p = path.join(TEST_RESULTS_DIR, entry);
    try {
      fs.rmSync(p, { recursive: true, force: true });
    } catch (err) {
      console.warn(`[mobile-runner] Could not remove ${p}: ${err.message}`);
    }
  }
  console.log('[mobile-runner] Cleaned output/test-results/* (cycle 1)');
}

// ---------------------------------------------------------------------------
// Tail tracker — last N lines + every error/fail line
// ---------------------------------------------------------------------------
class TailTracker {
  constructor(maxLines) {
    this.max = maxLines;
    this.tail = [];
    this.errors = [];
    this.errPattern = /\[ERROR\]|\[FAIL\]|FAIL: |Error: /;
  }
  push(line) {
    this.tail.push(line);
    if (this.tail.length > this.max) this.tail.shift();
    if (this.errPattern.test(line)) this.errors.push(line);
  }
  render() {
    const errBlock = this.errors.length
      ? `=== Error/Fail lines (${this.errors.length}) ===\n${this.errors.join('\n')}\n\n`
      : '';
    return `${errBlock}=== Last ${this.tail.length} lines ===\n${this.tail.join('\n')}\n`;
  }
}

// ---------------------------------------------------------------------------
// Pre-flight environment validation
// ---------------------------------------------------------------------------
function preflightEnv(scenario, platform, folder) {
  // Spec file existence
  const folderSeg = folder ? folder : '';
  const specRel = path.join('tests', 'mobile', folderSeg, `${scenario}.spec.ts`);
  const specAbs = path.join(OUTPUT_DIR, specRel);
  if (!fs.existsSync(specAbs)) {
    return { ok: false, reason: `Spec file not found: ${path.relative(PROJECT_ROOT, specAbs)}` };
  }

  // PLATFORM env mismatch (only fail if user set it to something different)
  if (process.env.PLATFORM && process.env.PLATFORM.toLowerCase() !== platform.toLowerCase()) {
    return {
      ok: false,
      reason: `process.env.PLATFORM="${process.env.PLATFORM}" does not match --platform=${platform}. Unset PLATFORM or pass the matching value.`,
    };
  }

  if (platform === 'android') {
    if (!process.env.ANDROID_HOME) {
      return { ok: false, reason: 'ANDROID_HOME is not set. Required for Android.' };
    }
    if (!fs.existsSync(process.env.ANDROID_HOME)) {
      return { ok: false, reason: `ANDROID_HOME="${process.env.ANDROID_HOME}" does not exist on disk.` };
    }
  }

  if (platform === 'ios') {
    if (process.platform !== 'darwin') {
      return { ok: false, reason: 'iOS execution requires macOS (xcrun is darwin-only).' };
    }
    const xcrun = spawnSync('which', ['xcrun']);
    if (xcrun.status !== 0) {
      return { ok: false, reason: 'xcrun not found on PATH. Install Xcode command-line tools.' };
    }
  }

  return { ok: true, specRel };
}

// ---------------------------------------------------------------------------
// Target detection
// ---------------------------------------------------------------------------
function detectCloud() {
  if (process.env.BROWSERSTACK_USERNAME) return 'BrowserStack';
  if (process.env.SAUCE_USERNAME) return 'Sauce Labs';
  if (process.env.LT_USERNAME) return 'LambdaTest';
  return null;
}

function detectTarget(platform) {
  const cloud = detectCloud();
  if (cloud) {
    return { ok: false, reason: `${cloud} credentials detected. Cloud support is Phase 2.` };
  }
  if (process.env.AWS_DEVICE_FARM_PROJECT_ARN) {
    return { ok: false, reason: 'AWS Device Farm is not supported.' };
  }

  if (platform === 'ios') {
    const udid = process.env.IOS_SIM_UDID;
    if (udid) return { ok: true, type: 'simulator', id: udid };
    // Pick first booted simulator
    const r = spawnSync('xcrun', ['simctl', 'list', 'booted'], { encoding: 'utf-8' });
    if (r.status === 0) {
      const m = r.stdout.match(/\(([0-9A-F-]{36})\) \(Booted\)/i);
      if (m) return { ok: true, type: 'simulator', id: m[1] };
    }
    return { ok: false, reason: 'No iOS simulator booted and IOS_SIM_UDID not set. Boot one or set IOS_SIM_UDID.' };
  }

  if (platform === 'android') {
    if (process.env.ANDROID_AVD) {
      // AVD takes precedence — implies emulator path even if not yet running.
      return { ok: true, type: 'emulator', avdName: process.env.ANDROID_AVD, id: null };
    }
    const r = spawnSync('adb', ['devices'], { encoding: 'utf-8' });
    if (r.status !== 0) {
      return { ok: false, reason: `adb command failed: ${(r.stderr || '').trim() || 'unknown error'}` };
    }
    const lines = r.stdout.split('\n').slice(1)
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('*') && /\tdevice$/.test(l))
      .map((l) => l.split('\t')[0]);

    if (lines.length === 0) return { ok: false, reason: 'No Android device detected (adb devices empty).' };
    if (lines.length > 1 && !process.env.ANDROID_DEVICE) {
      return {
        ok: false,
        reason: `Multiple Android devices detected: ${lines.join(', ')}. Set ANDROID_DEVICE to disambiguate.`,
      };
    }
    const serial = process.env.ANDROID_DEVICE || lines[0];
    if (process.env.ANDROID_DEVICE && !lines.includes(process.env.ANDROID_DEVICE)) {
      return { ok: false, reason: `ANDROID_DEVICE="${process.env.ANDROID_DEVICE}" not in adb devices list (${lines.join(', ')}).` };
    }
    const type = /^emulator-/.test(serial) ? 'emulator' : 'physical';
    return { ok: true, type, id: serial };
  }

  return { ok: false, reason: `Unknown platform: ${platform}` };
}

// ---------------------------------------------------------------------------
// Target health-check + auto-start
// ---------------------------------------------------------------------------
function isAndroidBooted(serial) {
  const r = spawnSync('adb', ['-s', serial, 'shell', 'getprop', 'sys.boot_completed'], { encoding: 'utf-8' });
  return r.status === 0 && r.stdout.trim() === '1';
}

function listAvds() {
  const r = spawnSync('emulator', ['-list-avds'], { encoding: 'utf-8' });
  if (r.status !== 0) return null;
  return r.stdout.split('\n').map((l) => l.trim()).filter(Boolean);
}

async function ensureAndroidEmulator(target, cfg) {
  const headless = !!cfg.target.headless;
  const bootTimeout = cfg.target.emulatorBootTimeoutMs;

  // If we already have a serial and it's booted, reuse.
  if (target.id && isAndroidBooted(target.id)) {
    return { ok: true, target: { ...target }, startedByRunner: false, bootDurationMs: 0 };
  }

  if (!target.avdName) {
    return { ok: false, infra: true, reason: `Emulator ${target.id || ''} not booted; no ANDROID_AVD provided to auto-start.` };
  }

  const avds = listAvds();
  if (avds && !avds.includes(target.avdName)) {
    return {
      ok: false,
      infra: false,
      reason: `AVD "${target.avdName}" not found. Available AVDs: ${avds.length ? avds.join(', ') : '(none)'}`,
    };
  }

  const launchArgs = ['-avd', target.avdName, '-no-boot-anim'];
  if (!cfg.target.useSnapshotForEmulator) launchArgs.push('-no-snapshot-load');
  if (headless) launchArgs.push('-no-window');

  console.log(`[mobile-runner] Launching emulator: emulator ${launchArgs.join(' ')}`);
  const start = Date.now();
  const child = spawn('emulator', launchArgs, {
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true,
  });
  child.stdout.on('data', () => {});
  child.stderr.on('data', () => {});
  child.unref();

  // Poll adb devices for the new emulator-* serial, then boot-completed.
  const deadline = Date.now() + bootTimeout;
  let serial = target.id;
  while (Date.now() < deadline) {
    if (!serial) {
      const r = spawnSync('adb', ['devices'], { encoding: 'utf-8' });
      if (r.status === 0) {
        const m = r.stdout.split('\n').map((l) => l.trim())
          .find((l) => /^emulator-\d+\tdevice$/.test(l));
        if (m) serial = m.split('\t')[0];
      }
    }
    if (serial && isAndroidBooted(serial)) {
      // Dismiss lock screen
      spawnSync('adb', ['-s', serial, 'shell', 'input', 'keyevent', '82'], { stdio: 'ignore' });
      const bootDurationMs = Date.now() - start;
      return { ok: true, target: { ...target, id: serial }, startedByRunner: true, bootDurationMs };
    }
    await sleep(2000);
  }
  return { ok: false, infra: true, reason: `Emulator "${target.avdName}" did not boot within ${bootTimeout}ms.` };
}

async function ensureIosSimulator(target, cfg) {
  const headless = !!cfg.target.headless;
  const bootTimeout = cfg.target.simulatorBootTimeoutMs;

  // If already booted, reuse.
  const r = spawnSync('xcrun', ['simctl', 'list', 'booted'], { encoding: 'utf-8' });
  if (r.status === 0 && r.stdout.includes(target.id)) {
    if (!headless) spawnSync('open', ['-a', 'Simulator'], { stdio: 'ignore' });
    return { ok: true, target: { ...target }, startedByRunner: false, bootDurationMs: 0 };
  }

  // Verify the UDID exists
  const list = spawnSync('xcrun', ['simctl', 'list', 'devices', 'available'], { encoding: 'utf-8' });
  if (list.status === 0 && !list.stdout.includes(target.id)) {
    return { ok: false, infra: false, reason: `Simulator UDID "${target.id}" not found in xcrun simctl list.` };
  }

  const start = Date.now();
  const boot = spawnSync('xcrun', ['simctl', 'boot', target.id], { encoding: 'utf-8' });
  if (boot.status !== 0 && !/already booted/i.test(boot.stderr || '')) {
    return { ok: false, infra: true, reason: `xcrun simctl boot failed: ${(boot.stderr || '').trim()}` };
  }
  if (!headless) spawnSync('open', ['-a', 'Simulator'], { stdio: 'ignore' });

  const deadline = Date.now() + bootTimeout;
  while (Date.now() < deadline) {
    const probe = spawnSync('xcrun', ['simctl', 'getenv', target.id, 'HOME'], { encoding: 'utf-8' });
    if (probe.status === 0 && probe.stdout.trim()) {
      return { ok: true, target: { ...target }, startedByRunner: true, bootDurationMs: Date.now() - start };
    }
    await sleep(2000);
  }
  return { ok: false, infra: true, reason: `Simulator "${target.id}" did not boot within ${bootTimeout}ms.` };
}

async function ensurePhysicalAndroid(target) {
  if (isAndroidBooted(target.id)) {
    return { ok: true, target: { ...target }, startedByRunner: false, bootDurationMs: 0 };
  }
  return { ok: false, infra: true, reason: `Physical device ${target.id} not booted (sys.boot_completed != 1).` };
}

// ---------------------------------------------------------------------------
// Appium lifecycle
// ---------------------------------------------------------------------------
async function ensureAppium(cfg, cycle) {
  const status = await appiumStatus(cfg.appium.url, 2000);
  if (status.ok) {
    return { ok: true, startedByRunner: false, bootDurationMs: 0 };
  }
  if (status.statusCode && !status.isAppium) {
    return { ok: false, env: true, reason: `Port held by non-Appium process (HTTP ${status.statusCode}).` };
  }
  if (!cfg.appium.autoStart) {
    return { ok: false, env: true, reason: 'Appium not running and mobile.appium.autoStart is false.' };
  }

  console.log('[mobile-runner] Auto-starting Appium server…');
  ensureTestResultsDir();
  const logPath = path.join(TEST_RESULTS_DIR, `appium-cycle${cycle}.log`);
  const logFd = fs.openSync(logPath, 'a');

  const start = Date.now();
  const child = spawn('appium', [], {
    stdio: ['ignore', logFd, logFd],
    detached: true,
    env: { ...process.env },
  });
  child.unref();

  const ready = await waitForAppium(cfg.appium.url, cfg.appium.startupTimeoutMs);
  if (!ready) {
    killProcessTree(child);
    return { ok: false, infra: true, reason: `Appium did not become ready within ${cfg.appium.startupTimeoutMs}ms. See ${path.relative(PROJECT_ROOT, logPath)}.` };
  }
  return { ok: true, startedByRunner: true, bootDurationMs: Date.now() - start, pid: child.pid, logPath };
}

// ---------------------------------------------------------------------------
// Wdio invocation — spawn, stream, enforce timeout
// ---------------------------------------------------------------------------
function runWdio({ specRel, platform, cycle, cfg, target }) {
  return new Promise((resolve) => {
    const rawPath = path.join(TEST_RESULTS_DIR, `cycle${cycle}-raw.txt`);
    const tailPath = path.join(TEST_RESULTS_DIR, `cycle${cycle}-tail.txt`);
    const rawFd = fs.openSync(rawPath, 'w');
    const tail = new TailTracker(cfg.runner.tailLines);

    const grep = `@${platform}-only|@cross-platform`;
    const wdioArgs = ['wdio', 'run', 'wdio.conf.ts', '--spec', specRel, '--mochaOpts.grep', grep];
    const wdioCmd = `PLATFORM=${platform} npx ${wdioArgs.join(' ')}`;

    const childEnv = {
      ...process.env,
      PLATFORM: platform,
      CYCLE_NUMBER: String(cycle),
    };
    if (target?.id && platform === 'android') childEnv.ANDROID_DEVICE = target.id;
    if (target?.id && platform === 'ios') childEnv.IOS_SIM_UDID = target.id;

    console.log(`[mobile-runner] Spawning: ${wdioCmd}`);
    const start = Date.now();
    const child = spawn('npx', wdioArgs, {
      cwd: OUTPUT_DIR,
      env: childEnv,
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: process.platform !== 'win32',
    });

    let buf = '';
    const onData = (chunk) => {
      const text = chunk.toString();
      try { fs.writeSync(rawFd, text); } catch { /* disk error — non-fatal */ }
      buf += text;
      let nl;
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl);
        buf = buf.slice(nl + 1);
        tail.push(line);
      }
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);

    const timeoutMs = cfg.runner.maxRunDurationMs;
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      console.warn(`[mobile-runner] wdio exceeded ${timeoutMs}ms — killing process tree.`);
      killProcessTree(child);
    }, timeoutMs);

    child.on('exit', (code, signal) => {
      clearTimeout(timer);
      if (buf.length) tail.push(buf);
      try { fs.closeSync(rawFd); } catch { /* already closed */ }
      try { fs.writeFileSync(tailPath, tail.render()); } catch { /* best effort */ }
      resolve({
        exitCode: code,
        signal,
        timedOut,
        wdioMs: Date.now() - start,
        wdioCommand: wdioCmd,
        rawPath: path.relative(OUTPUT_DIR, rawPath),
        tailPath: path.relative(OUTPUT_DIR, tailPath),
      });
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      try { fs.closeSync(rawFd); } catch { /* already closed */ }
      try { fs.writeFileSync(tailPath, `[mobile-runner] spawn error: ${err.message}\n${tail.render()}`); } catch { /* best effort */ }
      resolve({
        exitCode: null,
        signal: null,
        timedOut: false,
        spawnError: err.message,
        wdioMs: Date.now() - start,
        wdioCommand: wdioCmd,
        rawPath: path.relative(OUTPUT_DIR, rawPath),
        tailPath: path.relative(OUTPUT_DIR, tailPath),
      });
    });
  });
}

// ---------------------------------------------------------------------------
// Parser invocation
// ---------------------------------------------------------------------------
function invokeParser() {
  const wdioJsonAbs = path.join(TEST_RESULTS_DIR, 'mobile-results.json');
  const parsedAbs = path.join(TEST_RESULTS_DIR, 'last-run-parsed.json');
  const start = Date.now();

  if (!fs.existsSync(wdioJsonAbs)) {
    return { ok: false, reason: 'mobile-results.json not produced by wdio', parseMs: Date.now() - start };
  }

  const r = spawnSync('node', [
    path.join(PROJECT_ROOT, 'scripts', 'test-results-parser.js'),
    `--json-path=${wdioJsonAbs}`,
    `--output-path=${parsedAbs}`,
    '--runner=wdio',
  ], { encoding: 'utf-8' });

  if (r.status !== 0) {
    return { ok: false, reason: `parser exit ${r.status}: ${(r.stderr || '').trim()}`, parseMs: Date.now() - start };
  }

  let parsed = null;
  try {
    parsed = JSON.parse(fs.readFileSync(parsedAbs, 'utf-8'));
  } catch (err) {
    return { ok: false, reason: `could not read parsed JSON: ${err.message}`, parseMs: Date.now() - start };
  }
  return { ok: true, parsed, parsedRel: path.relative(OUTPUT_DIR, parsedAbs), parseMs: Date.now() - start };
}

// ---------------------------------------------------------------------------
// Failure artifact capture
//
// Phase 1 compatibility shim: the existing wdio.conf.ts template writes
// timestamp-suffixed FAILED-*.{xml,png}. We copy the most recent one (newer
// than runStartMs) to cycle{N}-suffixed names. Spec §11 question #2 — when
// the template is updated to use CYCLE_NUMBER, this shim becomes a no-op.
// ---------------------------------------------------------------------------
function findMostRecentFile(dir, pattern, runStartMs) {
  if (!fs.existsSync(dir)) return null;
  let best = null;
  for (const entry of fs.readdirSync(dir)) {
    if (!pattern.test(entry)) continue;
    const full = path.join(dir, entry);
    let stat;
    try { stat = fs.statSync(full); } catch { continue; }
    if (stat.mtimeMs < runStartMs) continue;
    if (!best || stat.mtimeMs > best.mtimeMs) best = { full, mtimeMs: stat.mtimeMs };
  }
  return best?.full || null;
}

function captureFailureArtifacts(cycle, runStartMs) {
  const out = { pageSource: null, screenshot: null };
  const psSrc = findMostRecentFile(path.join(TEST_RESULTS_DIR, 'page-sources'), /^FAILED-.*\.xml$/, runStartMs);
  if (psSrc) {
    const dst = path.join(TEST_RESULTS_DIR, `page-source-cycle${cycle}.xml`);
    try { fs.copyFileSync(psSrc, dst); out.pageSource = path.relative(OUTPUT_DIR, dst); }
    catch (err) { console.warn(`[mobile-runner] Could not copy page source: ${err.message}`); }
  }
  const ssSrc = findMostRecentFile(path.join(TEST_RESULTS_DIR, 'screenshots'), /^FAILED-.*\.png$/, runStartMs);
  if (ssSrc) {
    const dst = path.join(TEST_RESULTS_DIR, `test-failed-cycle${cycle}.png`);
    try { fs.copyFileSync(ssSrc, dst); out.screenshot = path.relative(OUTPUT_DIR, dst); }
    catch (err) { console.warn(`[mobile-runner] Could not copy screenshot: ${err.message}`); }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Cleanup (target + appium) — respects ownership flags + config.
// ---------------------------------------------------------------------------
function cleanupTarget(target, startedByRunner, cfg) {
  if (!startedByRunner || !cfg.target.cleanupOnExit) return;
  if (target.type === 'emulator' && target.id) {
    spawnSync('adb', ['-s', target.id, 'emu', 'kill'], { stdio: 'ignore' });
  } else if (target.type === 'simulator' && target.id) {
    spawnSync('xcrun', ['simctl', 'shutdown', target.id], { stdio: 'ignore' });
  }
}

function cleanupAppium(appiumPid, startedByRunner, cfg) {
  if (!startedByRunner || !cfg.appium.cleanupOnExit || !appiumPid) return;
  try {
    if (process.platform === 'win32') {
      spawnSync('taskkill', ['/F', '/T', '/PID', String(appiumPid)], { stdio: 'ignore' });
    } else {
      try { process.kill(-appiumPid, 'SIGTERM'); } catch { /* may not be group leader */ }
      try { process.kill(appiumPid, 'SIGTERM'); } catch { /* already dead */ }
    }
  } catch { /* best effort */ }
}

// ---------------------------------------------------------------------------
// Marker assembly
// ---------------------------------------------------------------------------
function buildMarker(base) {
  const m = {
    schemaVersion: SCHEMA_VERSION,
    scenario: base.scenario,
    platform: base.platform,
    cycle: base.cycle,
    status: base.status,
    timestamp: new Date().toISOString(),
    target: base.target || null,
    appium: base.appium || null,
    duration: base.duration || {},
    runnerVersion: RUNNER_VERSION,
    wdioCommand: base.wdioCommand || null,
  };
  if (base.results) m.results = base.results;
  if (base.artifacts) m.artifacts = base.artifacts;
  if (base.failureReason) m.failureReason = base.failureReason;
  return m;
}

// ---------------------------------------------------------------------------
// Status classification
// ---------------------------------------------------------------------------
function classifyStatus({ wdio, parsed }) {
  if (wdio.timedOut) {
    return { status: 'INFRA_FAILURE', failureReason: `wdio_hung — exceeded maxRunDurationMs and was killed.` };
  }
  if (wdio.spawnError) {
    return { status: 'INFRA_FAILURE', failureReason: `wdio spawn error: ${wdio.spawnError}` };
  }
  if (wdio.exitCode === 0) {
    if (parsed?.summary && parsed.summary.failed === 0 && parsed.summary.total > 0) {
      return { status: 'TEST_PASS' };
    }
    if (parsed?.summary && parsed.summary.total === 0) {
      // wdio reported success but ran zero tests — likely infra (grep filter, no specs matched).
      return { status: 'INFRA_FAILURE', failureReason: 'wdio exited 0 but ran 0 tests (check spec path / grep filter).' };
    }
    return { status: 'TEST_PASS' };
  }
  // Non-zero exit
  if (parsed?.summary && parsed.summary.failed > 0) {
    return { status: 'TEST_FAILURE' };
  }
  return {
    status: 'INFRA_FAILURE',
    failureReason: `wdio exit ${wdio.exitCode}${wdio.signal ? ` (signal ${wdio.signal})` : ''}; no parsed test results — session likely never created.`,
  };
}

function extractFirstFailure(parsed) {
  if (!parsed?.failures || parsed.failures.length === 0) return null;
  const f = parsed.failures[0];
  return {
    title: f.testName || f.failedStep || '(unknown)',
    stepIndex: f.failedStepNumber || null,
    errorMessage: (f.error?.message || '').slice(0, 500),
    errorType: f.error?.category_label || 'Unclassified',
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  // 1. Validate args
  const scenario = args.scenario;
  const platform = (args.platform || '').toLowerCase();
  const cycleN = parseInt(args.cycle, 10);
  const folder = args.folder || null;

  if (!scenario || !platform || !cycleN || cycleN < 1) {
    console.error('Usage: node scripts/mobile-runner.js --scenario=<name> --platform=<android|ios> --cycle=<N> [--folder=<sub>]');
    process.exit(2);
  }
  if (platform !== 'android' && platform !== 'ios') {
    console.error(`Invalid --platform=${platform}. Must be android or ios.`);
    process.exit(2);
  }

  const cfg = loadConfig();
  const t0 = Date.now();
  let preflightMs = 0;
  let targetBootMs = 0;
  let appiumBootMs = 0;
  let wdioMs = 0;
  let parseMs = 0;
  let cleanupMs = 0;

  const baseMarker = {
    scenario,
    platform,
    cycle: cycleN,
  };

  // 2. Cleanup gate
  cleanupGate(cycleN, cfg);

  // 3. Pre-flight env
  const tEnv0 = Date.now();
  const env = preflightEnv(scenario, platform, folder);
  preflightMs += Date.now() - tEnv0;
  if (!env.ok) {
    return exitWithMarker(cycleN, buildMarker({
      ...baseMarker,
      status: 'ENV_FAILURE',
      failureReason: env.reason,
      duration: { totalMs: Date.now() - t0, preflightMs },
    }));
  }
  const specRel = env.specRel;

  // 4. Target detection
  const tDetect0 = Date.now();
  const detected = detectTarget(platform);
  preflightMs += Date.now() - tDetect0;
  if (!detected.ok) {
    return exitWithMarker(cycleN, buildMarker({
      ...baseMarker,
      status: 'ENV_FAILURE',
      failureReason: detected.reason,
      duration: { totalMs: Date.now() - t0, preflightMs },
    }));
  }

  // 5. Target health-check + auto-start
  let targetInfo = { type: detected.type, id: detected.id, avdName: detected.avdName };
  let targetResult;
  if (detected.type === 'emulator') {
    targetResult = await ensureAndroidEmulator(targetInfo, cfg);
  } else if (detected.type === 'simulator') {
    targetResult = await ensureIosSimulator(targetInfo, cfg);
  } else if (detected.type === 'physical') {
    targetResult = await ensurePhysicalAndroid(targetInfo);
  } else {
    return exitWithMarker(cycleN, buildMarker({
      ...baseMarker,
      status: 'ENV_FAILURE',
      failureReason: `Unsupported target type: ${detected.type}`,
      duration: { totalMs: Date.now() - t0, preflightMs },
    }));
  }
  if (!targetResult.ok) {
    return exitWithMarker(cycleN, buildMarker({
      ...baseMarker,
      status: targetResult.infra ? 'INFRA_FAILURE' : 'ENV_FAILURE',
      failureReason: targetResult.reason,
      target: { ...targetInfo, startedByRunner: false },
      duration: { totalMs: Date.now() - t0, preflightMs },
    }));
  }
  targetInfo = targetResult.target;
  targetBootMs = targetResult.bootDurationMs;
  const targetStartedByRunner = targetResult.startedByRunner;

  // 6. Appium health-check + auto-start
  const appiumResult = await ensureAppium(cfg, cycleN);
  if (!appiumResult.ok) {
    return exitWithMarker(cycleN, buildMarker({
      ...baseMarker,
      status: appiumResult.env ? 'ENV_FAILURE' : 'INFRA_FAILURE',
      failureReason: appiumResult.reason,
      target: { ...targetInfo, startedByRunner: targetStartedByRunner },
      duration: { totalMs: Date.now() - t0, preflightMs, targetBootMs },
    }));
  }
  appiumBootMs = appiumResult.bootDurationMs;
  const appiumStartedByRunner = appiumResult.startedByRunner;
  const appiumPid = appiumResult.pid;

  // 7. Spawn wdio
  const runStartMs = Date.now();
  const wdio = await runWdio({ specRel, platform, cycle: cycleN, cfg, target: targetInfo });
  wdioMs = wdio.wdioMs;

  // 8. Parse results
  const parserOut = invokeParser();
  parseMs = parserOut.parseMs;

  // 9. Capture failure artifacts (if any)
  const artifactsCaptured = captureFailureArtifacts(cycleN, runStartMs);

  // 10. Classify status
  const status = classifyStatus({ wdio, parsed: parserOut.parsed });

  // 11. Build marker
  const artifacts = {
    rawLog: wdio.rawPath,
    tailLog: wdio.tailPath,
    parsedJson: parserOut.parsedRel || null,
    pageSource: artifactsCaptured.pageSource,
    screenshot: artifactsCaptured.screenshot,
  };

  const target = {
    type: targetInfo.type,
    id: targetInfo.id,
    platformVersion: null,
    startedByRunner: targetStartedByRunner,
    bootDurationMs: targetBootMs,
    accelerationStatus: null,
    headless: !!cfg.target.headless,
  };

  const appium = {
    url: cfg.appium.url,
    version: null,
    startedByRunner: appiumStartedByRunner,
  };

  let results;
  if (parserOut.ok && parserOut.parsed?.summary) {
    const s = parserOut.parsed.summary;
    results = {
      total: s.total,
      passed: s.passed,
      failed: s.failed,
    };
    const ff = extractFirstFailure(parserOut.parsed);
    if (ff) results.firstFailure = ff;
  }

  // 12. Cleanup
  const tCleanup0 = Date.now();
  cleanupTarget(targetInfo, targetStartedByRunner, cfg);
  cleanupAppium(appiumPid, appiumStartedByRunner, cfg);
  cleanupMs = Date.now() - tCleanup0;

  const marker = buildMarker({
    ...baseMarker,
    status: status.status,
    target,
    appium,
    duration: {
      totalMs: Date.now() - t0,
      preflightMs,
      targetBootMs,
      appiumBootMs,
      wdioMs,
      parseMs,
      cleanupMs,
    },
    results,
    artifacts,
    failureReason: status.failureReason,
    wdioCommand: wdio.wdioCommand,
  });

  return exitWithMarker(cycleN, marker);
}

// ---------------------------------------------------------------------------
// Outermost try/catch — guarantees a RUNNER_CRASH marker on any uncaught error
// ---------------------------------------------------------------------------
(async () => {
  // Attempt to extract cycle from args even if we crash early
  const cycleForCrash = parseInt(args.cycle, 10) || 0;
  try {
    await main();
  } catch (err) {
    console.error(`[mobile-runner] RUNNER_CRASH: ${err.stack || err.message}`);
    if (cycleForCrash >= 1) {
      try {
        exitWithMarker(cycleForCrash, buildMarker({
          scenario: args.scenario || 'unknown',
          platform: (args.platform || 'unknown').toLowerCase(),
          cycle: cycleForCrash,
          status: 'RUNNER_CRASH',
          failureReason: err.message,
          duration: {},
        }));
      } catch {
        process.exit(0);
      }
    } else {
      process.exit(2);
    }
  }
})();
