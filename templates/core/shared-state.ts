import * as fs from 'fs';
import * as path from 'path';

/**
 * Shared State — Persist values across scenarios via shared-state.json.
 * Used by the SAVE keyword.
 */

const STATE_FILE = path.resolve(__dirname, '..', 'test-data', 'shared-state.json');

export function saveState(key: string, value: any): void {
  let state: Record<string, any> = {};
  if (fs.existsSync(STATE_FILE)) {
    state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
  }
  state[key] = value;
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

export function loadState(key: string): any {
  if (!fs.existsSync(STATE_FILE)) return undefined;
  const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
  return state[key];
}

export function loadAllState(): Record<string, any> {
  if (!fs.existsSync(STATE_FILE)) return {};
  return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
}

export function clearState(key: string): void {
  if (!fs.existsSync(STATE_FILE)) return;
  const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
  delete state[key];
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

export function clearAllState(): void {
  fs.writeFileSync(STATE_FILE, JSON.stringify({}, null, 2));
}
