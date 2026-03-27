import * as fs from 'fs';
import * as path from 'path';

/**
 * Shared State — Persist values across scenarios via shared-state.json.
 * Used by the SAVE keyword.
 *
 * Thread-safe: Uses a lockfile to prevent concurrent write corruption
 * when Playwright runs tests with workers > 1.
 */

const STATE_FILE = path.resolve(__dirname, '..', 'test-data', 'shared-state.json');
const LOCK_FILE = STATE_FILE + '.lock';
const LOCK_TIMEOUT = 5000; // 5 seconds max wait for lock
const LOCK_RETRY_INTERVAL = 50; // 50ms between retries

/**
 * Acquire a file lock. Waits up to LOCK_TIMEOUT ms.
 */
function acquireLock(): void {
  const start = Date.now();
  while (Date.now() - start < LOCK_TIMEOUT) {
    try {
      // O_CREAT | O_EXCL — fails if file already exists (atomic check)
      fs.writeFileSync(LOCK_FILE, String(process.pid), { flag: 'wx' });
      return; // Lock acquired
    } catch {
      // Lock exists — wait and retry
      const elapsed = Date.now() - start;
      if (elapsed > LOCK_TIMEOUT) break;
      // Busy wait (sync — Playwright test context is sync-compatible)
      const waitUntil = Date.now() + LOCK_RETRY_INTERVAL;
      while (Date.now() < waitUntil) { /* spin */ }
    }
  }
  // Timeout — force break stale lock (process may have crashed)
  try { fs.unlinkSync(LOCK_FILE); } catch { /* ignore */ }
  fs.writeFileSync(LOCK_FILE, String(process.pid), { flag: 'wx' });
}

/**
 * Release the file lock.
 */
function releaseLock(): void {
  try { fs.unlinkSync(LOCK_FILE); } catch { /* ignore */ }
}

/**
 * Save a key-value pair to shared state (thread-safe).
 */
export function saveState(key: string, value: any): void {
  acquireLock();
  try {
    let state: Record<string, any> = {};
    if (fs.existsSync(STATE_FILE)) {
      state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
    }
    state[key] = value;
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } finally {
    releaseLock();
  }
}

/**
 * Load a value from shared state.
 */
export function loadState(key: string): any {
  if (!fs.existsSync(STATE_FILE)) return undefined;
  const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
  return state[key];
}

/**
 * Load entire shared state.
 */
export function loadAllState(): Record<string, any> {
  if (!fs.existsSync(STATE_FILE)) return {};
  return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
}

/**
 * Clear a specific key from shared state (thread-safe).
 */
export function clearState(key: string): void {
  acquireLock();
  try {
    if (!fs.existsSync(STATE_FILE)) return;
    const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
    delete state[key];
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } finally {
    releaseLock();
  }
}

/**
 * Clear all shared state (thread-safe).
 */
export function clearAllState(): void {
  acquireLock();
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify({}, null, 2));
  } finally {
    releaseLock();
  }
}
