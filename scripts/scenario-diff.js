#!/usr/bin/env node

/**
 * scenario-diff.js — Detects changes between modified scenario .md and existing spec
 * For incremental updates: only re-explore changed/new steps.
 *
 * Usage: node scripts/scenario-diff.js --scenario=<path> [--spec=<path>] [--output=<path>]
 *
 * Extracts steps from ALL sections: Common Setup Once, Common Setup, Steps,
 * Common Teardown, Common Teardown Once.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const args = {};
process.argv.slice(2).forEach(arg => {
  const match = arg.match(/^--([\w-]+)=(.+)$/);
  if (match) args[match[1]] = match[2];
});

const scenarioFile = args.scenario;
if (!scenarioFile) { console.error('Usage: node scripts/scenario-diff.js --scenario=<path> [--spec=<path>] [--output=<path>]'); process.exit(1); }
if (!fs.existsSync(scenarioFile)) { console.error(`Not found: ${scenarioFile}`); process.exit(1); }

/**
 * Extract steps from ALL sections of a scenario .md file.
 * Sections: Common Setup Once, Common Setup, Steps, Common Teardown, Common Teardown Once
 * Also extracts steps from ### Scenario: blocks within Steps.
 */
function extractAllSteps(mdContent) {
  const steps = [];
  const lines = mdContent.split('\n');
  // Sections that contain numbered steps
  const stepSections = /^##\s+(Common Setup Once|Common Setup|Steps|Common Teardown Once|Common Teardown)\s*$/i;
  // End of a step section
  const sectionEnd = /^##\s+[^#]/;
  // Scenario sub-sections within Steps are fine — keep collecting
  const subScenario = /^###\s+Scenario:/i;

  let inStepSection = false;
  let currentSection = '';

  for (const line of lines) {
    const trimmed = line.trim();

    // Detect step section start
    const sectionMatch = trimmed.match(stepSections);
    if (sectionMatch) {
      inStepSection = true;
      currentSection = sectionMatch[1];
      continue;
    }

    // Detect section end (new ## heading that's NOT a step section and NOT ### scenario)
    if (inStepSection && sectionEnd.test(trimmed) && !stepSections.test(trimmed) && !subScenario.test(trimmed)) {
      // Allow ### Scenario: to continue collecting
      if (trimmed.startsWith('### ')) continue;
      inStepSection = false;
      continue;
    }

    // Collect numbered steps
    if (inStepSection && trimmed.match(/^\d+\.\s+/)) {
      const stepText = trimmed.replace(/^\d+\.\s+/, '').trim();
      steps.push({ text: stepText, section: currentSection });
    }
  }

  return steps;
}

/**
 * Extract step descriptions from spec file test.step() calls
 */
function extractSpecSteps(specContent) {
  const steps = [];
  for (const line of specContent.split('\n')) {
    // Match: test.step('Step N — description', ...) or test.step('[Setup] description', ...)
    const match = line.match(/test\.step\(['"](?:Step\s+\d+\s*[—–-]\s*|(?:\[[\w\s]+\]\s*))(.+?)['"]/i);
    if (match) steps.push(match[1].trim());
  }
  return steps;
}

const scenarioSteps = extractAllSteps(fs.readFileSync(scenarioFile, 'utf-8'));
let specSteps = [];
if (args.spec && fs.existsSync(args.spec)) specSteps = extractSpecSteps(fs.readFileSync(args.spec, 'utf-8'));

// If no spec exists, all steps are new
if (specSteps.length === 0) {
  const changeset = {
    scenario: scenarioFile, spec: args.spec || 'none',
    totalScenarioSteps: scenarioSteps.length, totalSpecSteps: 0,
    unchanged: [], modified: [],
    added: scenarioSteps.map((s, i) => ({ position: i + 1, text: s.text, section: s.section })),
    deleted: [],
    summary: `All ${scenarioSteps.length} steps are new (no existing spec found)`,
  };
  const outputFile = args.output || path.join(ROOT, 'output', 'reports', 'scenario-changeset.json');
  const outputDir = path.dirname(outputFile);
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(outputFile, JSON.stringify(changeset, null, 2));
  console.log(changeset.summary);
  console.log(`Output: ${outputFile}`);
  process.exit(0);
}

// Compare steps (position-based text comparison)
const unchanged = [], modified = [], added = [], deleted = [];
const maxLen = Math.max(scenarioSteps.length, specSteps.length);

for (let i = 0; i < maxLen; i++) {
  const s = scenarioSteps[i];
  const p = specSteps[i];

  if (s && p) {
    const ns = s.text.toLowerCase().replace(/[^\w\s]/g, '').trim();
    const np = p.toLowerCase().replace(/[^\w\s]/g, '').trim();
    if (ns === np) unchanged.push({ position: i + 1, text: s.text, section: s.section });
    else modified.push({ position: i + 1, oldText: p, newText: s.text, section: s.section });
  } else if (s && !p) {
    added.push({ position: i + 1, text: s.text, section: s.section });
  } else if (!s && p) {
    deleted.push({ position: i + 1, text: p });
  }
}

const changeset = {
  scenario: scenarioFile, spec: args.spec,
  totalScenarioSteps: scenarioSteps.length, totalSpecSteps: specSteps.length,
  unchanged, modified, added, deleted,
  summary: `${unchanged.length} unchanged, ${modified.length} modified, ${added.length} added, ${deleted.length} deleted`,
};

const outputFile = args.output || path.join(ROOT, 'output', 'reports', 'scenario-changeset.json');
const outputDir = path.dirname(outputFile);
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(outputFile, JSON.stringify(changeset, null, 2));
console.log(`\nScenario Diff: ${changeset.summary}`);
console.log(`Output: ${outputFile}`);
