#!/usr/bin/env node

/**
 * scenario-diff.js — Detects changes between modified scenario .md and existing spec
 * For incremental updates: only re-explore changed/new steps.
 *
 * Usage: node scripts/scenario-diff.js --scenario=<path> [--spec=<path>] [--output=<path>]
 */

const fs = require('fs');
const path = require('path');

const args = {};
process.argv.slice(2).forEach(arg => {
  const match = arg.match(/^--([\w-]+)=(.+)$/);
  if (match) args[match[1]] = match[2];
});

const scenarioFile = args.scenario;
if (!scenarioFile) { console.error('Usage: node scripts/scenario-diff.js --scenario=<path>'); process.exit(1); }
if (!fs.existsSync(scenarioFile)) { console.error(`Not found: ${scenarioFile}`); process.exit(1); }

function extractSteps(mdContent) {
  const steps = [];
  let inSteps = false;
  for (const line of mdContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.match(/^##\s+Steps/i)) { inSteps = true; continue; }
    if (inSteps && trimmed.match(/^##\s+[^#]/) && !trimmed.match(/^###/)) { inSteps = false; continue; }
    if (inSteps && trimmed.match(/^\d+\.\s+/)) steps.push(trimmed.replace(/^\d+\.\s+/, '').trim());
  }
  return steps;
}

function extractSpecSteps(specContent) {
  const steps = [];
  for (const line of specContent.split('\n')) {
    const match = line.match(/test\.step\(['"]Step\s+\d+\s*[—–-]\s*(.+?)['"]/i);
    if (match) steps.push(match[1].trim());
  }
  return steps;
}

const scenarioSteps = extractSteps(fs.readFileSync(scenarioFile, 'utf-8'));
let specSteps = [];
if (args.spec && fs.existsSync(args.spec)) specSteps = extractSpecSteps(fs.readFileSync(args.spec, 'utf-8'));

const unchanged = [], modified = [], added = [], deleted = [];
const maxLen = Math.max(scenarioSteps.length, specSteps.length);

for (let i = 0; i < maxLen; i++) {
  const s = scenarioSteps[i], p = specSteps[i];
  if (s && p) {
    const ns = s.toLowerCase().replace(/[^\w\s]/g, '').trim();
    const np = p.toLowerCase().replace(/[^\w\s]/g, '').trim();
    if (ns === np) unchanged.push({ position: i + 1, text: s });
    else modified.push({ position: i + 1, oldText: p, newText: s });
  } else if (s && !p) added.push({ position: i + 1, text: s });
  else if (!s && p) deleted.push({ position: i + 1, text: p });
}

const changeset = {
  scenario: scenarioFile, spec: args.spec || 'none',
  totalScenarioSteps: scenarioSteps.length, totalSpecSteps: specSteps.length,
  unchanged, modified, added, deleted,
  summary: `${unchanged.length} unchanged, ${modified.length} modified, ${added.length} added, ${deleted.length} deleted`,
};

const outputFile = args.output || 'scenario-changeset.json';
fs.writeFileSync(outputFile, JSON.stringify(changeset, null, 2));
console.log(`Scenario Diff: ${changeset.summary}`);
