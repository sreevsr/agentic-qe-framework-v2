#!/usr/bin/env node

/**
 * rule-sync-check.js — Detect drift between universal rules in executor.md
 * and their mirrors in executor-mobile.md.
 *
 * BACKGROUND: Several rule blocks in executor-mobile.md are deliberate verbatim
 * mirrors of rules in executor.md (Fix Rules #9–11, the §4.7 Informed Retargeting
 * Exception, etc.). They were inlined rather than cross-referenced because LLM
 * agents are unreliable at hopping between documents mid-cycle. This script
 * detects when the source of truth in executor.md changes — so a maintainer who
 * edits executor.md is told which mirrors in executor-mobile.md to verify.
 *
 * USAGE:
 *   node scripts/rule-sync-check.js              # Check (exit 1 if drift)
 *   node scripts/rule-sync-check.js --check      # Same as default
 *   node scripts/rule-sync-check.js --rehash     # Update stored hashes
 *   node scripts/rule-sync-check.js --list       # List tracked rules
 *
 * WORKFLOW WHEN UPDATING A UNIVERSAL RULE:
 *   1. Edit the rule in agents/core/executor.md (the source of truth).
 *   2. Run `node scripts/rule-sync-check.js`. The script will tell you which
 *      mirrors in executor-mobile.md need updating.
 *   3. Update the mirror in agents/core/executor-mobile.md (search for the
 *      `<!-- MIRRORED FROM executor.md §X -->` comment markers).
 *   4. Run `node scripts/rule-sync-check.js --rehash` to bless the new hashes.
 *   5. Commit all three files together (executor.md + executor-mobile.md +
 *      .rule-sync-hashes.json).
 *
 * EXIT CODES:
 *   0 — no drift, or --rehash succeeded
 *   1 — drift detected, mirrors need review
 *   2 — script error (source file missing, regex didn't match, etc.)
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const SOURCE_FILE = path.join(ROOT, 'agents', 'core', 'executor.md');
const MIRROR_FILE = path.join(ROOT, 'agents', 'core', 'executor-mobile.md');
const HASH_FILE = path.join(__dirname, '.rule-sync-hashes.json');

// ---------------------------------------------------------------------------
// Tracked rules — each entry names a section/rule in executor.md whose content
// is mirrored in executor-mobile.md. The `extract` regex MUST capture the rule
// body and only the rule body; the body's hash is what we track.
//
// When a rule's hash changes, the mirror in executor-mobile.md may be stale —
// the script reports which mirror anchor to update.
// ---------------------------------------------------------------------------
const TRACKED_RULES = [
  {
    id: 'fix-rule-9-semantic-guard',
    description: 'Fix Rule #9 — Semantic Guard',
    // Captures from "9. **MUST NOT change the element target" up to (but not
    // including) "10. **MUST limit"
    extract: /(?:^|\n)9\.\s+\*\*MUST NOT change the element target[\s\S]*?(?=\n10\.\s+\*\*MUST limit)/,
    mirrorAnchor: '<!-- MIRRORED FROM executor.md §4.6 rule #9 (Semantic Guard)',
  },
  {
    id: 'fix-rule-10-necessary-and-sufficient',
    description: 'Fix Rule #10 — Necessary-and-Sufficient Scope',
    extract: /(?:^|\n)10\.\s+\*\*MUST limit the fix[\s\S]*?(?=\n11\.\s+\*\*MUST NOT add new `throw`)/,
    mirrorAnchor: '<!-- MIRRORED FROM executor.md §4.6 rule #10 (Necessary-and-Sufficient Scope)',
  },
  {
    id: 'fix-rule-11-throw-free',
    description: 'Fix Rule #11 — Throw-Free Page-Object Fixes',
    extract: /(?:^|\n)11\.\s+\*\*MUST NOT add new `throw`[\s\S]*?(?=\n###\s+4\.7:)/,
    mirrorAnchor: '<!-- MIRRORED FROM executor.md §4.6 rule #11 (Throw-Free Page-Object Fixes)',
  },
  {
    id: 'option-e-informed-retargeting',
    description: '§4.7 Informed Retargeting Exception under Option (e)',
    extract: /\*\*Informed retargeting under Option \(e\) — CONDITIONAL EXCEPTION\.\*\*[\s\S]*?(?=\n\*\*The `UNFIXABLE:` marker\*\* signals to humans)/,
    mirrorAnchor: '<!-- MIRRORED FROM executor.md §4.7 Informed Retargeting Exception under Option (e)',
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function hash(text) {
  return crypto.createHash('sha256').update(text.trim()).digest('hex').slice(0, 16);
}

function loadSource() {
  if (!fs.existsSync(SOURCE_FILE)) {
    console.error(`[rule-sync-check] Source not found: ${path.relative(ROOT, SOURCE_FILE)}`);
    process.exit(2);
  }
  return fs.readFileSync(SOURCE_FILE, 'utf-8');
}

function loadMirror() {
  if (!fs.existsSync(MIRROR_FILE)) return null;
  return fs.readFileSync(MIRROR_FILE, 'utf-8');
}

function loadStoredHashes() {
  if (!fs.existsSync(HASH_FILE)) return null;
  return JSON.parse(fs.readFileSync(HASH_FILE, 'utf-8'));
}

function computeCurrentHashes() {
  const source = loadSource();
  const out = {};
  const errors = [];
  for (const rule of TRACKED_RULES) {
    const m = source.match(rule.extract);
    if (!m) {
      errors.push(`Could not extract "${rule.description}" (id: ${rule.id}) from ${path.relative(ROOT, SOURCE_FILE)}. The regex did not match — has the section been renamed or removed?`);
      continue;
    }
    out[rule.id] = hash(m[0]);
  }
  return { hashes: out, errors };
}

function verifyMirrorAnchors() {
  const mirror = loadMirror();
  if (mirror === null) {
    return [`Mirror file not found: ${path.relative(ROOT, MIRROR_FILE)}`];
  }
  const missing = [];
  for (const rule of TRACKED_RULES) {
    if (!mirror.includes(rule.mirrorAnchor)) {
      missing.push(`Anchor missing in mirror file for rule "${rule.id}": expected substring "${rule.mirrorAnchor}..."`);
    }
  }
  return missing;
}

// ---------------------------------------------------------------------------
// Modes
// ---------------------------------------------------------------------------
const argv = process.argv.slice(2);
const mode = argv.includes('--rehash') ? 'rehash'
  : argv.includes('--list') ? 'list'
  : 'check';

if (mode === 'list') {
  console.log('Tracked universal rules (executor.md → executor-mobile.md mirror):');
  for (const rule of TRACKED_RULES) {
    console.log(`  - ${rule.id}: ${rule.description}`);
    console.log(`    anchor in mirror: ${rule.mirrorAnchor}...`);
  }
  process.exit(0);
}

const { hashes: current, errors } = computeCurrentHashes();
if (errors.length) {
  console.error('[rule-sync-check] Extraction errors:');
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(2);
}

const anchorErrors = verifyMirrorAnchors();
if (anchorErrors.length) {
  console.error('[rule-sync-check] Mirror anchor errors:');
  for (const e of anchorErrors) console.error(`  - ${e}`);
  console.error('  Hint: open executor-mobile.md and verify the `<!-- MIRRORED FROM ... -->` comments are intact.');
  process.exit(2);
}

if (mode === 'rehash') {
  fs.writeFileSync(HASH_FILE, JSON.stringify(current, null, 2) + '\n');
  console.log(`[rule-sync-check] Rehashed ${Object.keys(current).length} rules → ${path.relative(ROOT, HASH_FILE)}`);
  console.log('  Commit this file alongside the executor.md / executor-mobile.md changes.');
  process.exit(0);
}

// Check mode (default)
const stored = loadStoredHashes();
if (stored === null) {
  console.error(`[rule-sync-check] No stored hashes at ${path.relative(ROOT, HASH_FILE)}.`);
  console.error('  Run `node scripts/rule-sync-check.js --rehash` once to bless the current state.');
  process.exit(2);
}

const drifted = [];
const newRules = [];
const removedRules = [];

for (const [id, h] of Object.entries(current)) {
  if (!stored[id]) newRules.push(id);
  else if (stored[id] !== h) drifted.push(id);
}
for (const id of Object.keys(stored)) {
  if (!current[id]) removedRules.push(id);
}

if (drifted.length === 0 && newRules.length === 0 && removedRules.length === 0) {
  console.log(`[rule-sync-check] ✓ No drift. ${Object.keys(current).length} universal rule(s) in sync.`);
  process.exit(0);
}

console.error('[rule-sync-check] ✗ Drift detected:');
for (const id of drifted) {
  const rule = TRACKED_RULES.find((r) => r.id === id);
  console.error(`\n  CHANGED in executor.md: ${rule.description} (${id})`);
  console.error(`    Mirror anchor in executor-mobile.md: ${rule.mirrorAnchor}...`);
  console.error(`    Action: review the mirror, propagate the change, then run --rehash.`);
}
for (const id of newRules) {
  const rule = TRACKED_RULES.find((r) => r.id === id);
  console.error(`\n  NEW tracked rule (no stored hash): ${rule.description} (${id})`);
  console.error(`    Action: add the mirror to executor-mobile.md, then run --rehash.`);
}
for (const id of removedRules) {
  console.error(`\n  REMOVED from TRACKED_RULES (no longer extracted): ${id}`);
  console.error('    Action: remove the mirror from executor-mobile.md, then run --rehash.');
}
console.error('\n  Workflow:');
console.error('    1. Edit the mirror in agents/core/executor-mobile.md (search for the anchor comment).');
console.error('    2. Run `node scripts/rule-sync-check.js --rehash` to bless the new state.');
console.error('    3. Commit executor.md + executor-mobile.md + .rule-sync-hashes.json together.');
process.exit(1);
