#!/usr/bin/env node

/**
 * builder-incremental.js — Incremental update orchestration for the Builder agent
 *
 * DESIGN PRINCIPLE: Scripts for evidence, LLMs for judgment.
 * This script handles the MERGE logic deterministically — the Builder only
 * generates code for changed steps, and this script merges it into the
 * existing spec file. The LLM never sees unchanged code and cannot overwrite it.
 *
 * Usage:
 *   node scripts/builder-incremental.js --scenario=<name> --type=<web|api|hybrid> [--folder=<folder>]
 *
 * What it does:
 *   1. Checks if spec file already exists (if not → signals full generation)
 *   2. Runs scenario-diff.js to detect changes
 *   3. If changes found → creates a partial enriched.md with ONLY changed/added steps
 *   4. Outputs a builder-instructions.json that tells the Builder what to do
 *   5. After Builder runs → merges Builder's output into existing spec (future: post-merge)
 *
 * Output:
 *   output/reports/builder-instructions.json
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------
const args = {};
process.argv.slice(2).forEach(arg => {
  const match = arg.match(/^--(\w[\w-]*)=(.+)$/);
  if (match) args[match[1]] = match[2];
});

const scenario = args.scenario;
const type = args.type || 'web';
const folder = args.folder || null;

if (!scenario) {
  console.error('Usage: node scripts/builder-incremental.js --scenario=<name> --type=<web|api|hybrid> [--folder=<folder>]');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Path resolution
// ---------------------------------------------------------------------------
const projectRoot = path.resolve(__dirname, '..');
const outputDir = path.join(projectRoot, 'output');
const folderPrefix = folder ? path.join(folder) : '';

const paths = {
  enrichedFile: path.join(projectRoot, 'scenarios', type, folderPrefix, `${scenario}.enriched.md`),
  scenarioFile: path.join(projectRoot, 'scenarios', type, folderPrefix, `${scenario}.md`),
  specFile: path.join(outputDir, 'tests', type, folderPrefix, `${scenario}.spec.ts`),
  specFileJs: path.join(outputDir, 'tests', type, folderPrefix, `${scenario}.spec.js`),
  changesetFile: path.join(outputDir, 'reports', 'scenario-changeset.json'),
  instructionsFile: path.join(outputDir, 'reports', 'builder-instructions.json'),
  partialEnrichedFile: path.join(outputDir, 'reports', `${scenario}-partial-enriched.md`),
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function fileExists(p) { return fs.existsSync(p); }
function readFile(p) { return fs.readFileSync(p, 'utf-8'); }

// ---------------------------------------------------------------------------
// Step 1: Determine generation mode
// ---------------------------------------------------------------------------
const enrichedPath = fileExists(paths.enrichedFile) ? paths.enrichedFile : paths.scenarioFile;
if (!fileExists(enrichedPath)) {
  console.error(`Scenario file not found: ${enrichedPath}`);
  process.exit(1);
}

const specPath = fileExists(paths.specFile) ? paths.specFile : (fileExists(paths.specFileJs) ? paths.specFileJs : null);

if (!specPath) {
  // No existing spec → full generation
  const instructions = {
    mode: 'FULL',
    reason: 'No existing spec file found — full generation required',
    enrichedFile: enrichedPath,
    partialEnrichedFile: null,
    changeset: null,
    preserveFiles: [],
    timestamp: new Date().toISOString(),
  };

  fs.mkdirSync(path.dirname(paths.instructionsFile), { recursive: true });
  fs.writeFileSync(paths.instructionsFile, JSON.stringify(instructions, null, 2));
  console.log('Mode: FULL (no existing spec)');
  console.log(`Instructions: ${paths.instructionsFile}`);
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Step 2: Run scenario-diff.js
// ---------------------------------------------------------------------------
console.log('Running scenario-diff...');
try {
  execSync(
    `node "${path.join(projectRoot, 'scripts', 'scenario-diff.js')}" --scenario="${enrichedPath}" --spec="${specPath}" --output="${paths.changesetFile}"`,
    { stdio: 'pipe' }
  );
} catch (err) {
  console.error('scenario-diff.js failed — falling back to FULL generation');
  const instructions = {
    mode: 'FULL',
    reason: `scenario-diff.js failed: ${err.message}`,
    enrichedFile: enrichedPath,
    partialEnrichedFile: null,
    changeset: null,
    preserveFiles: [],
    timestamp: new Date().toISOString(),
  };
  fs.writeFileSync(paths.instructionsFile, JSON.stringify(instructions, null, 2));
  console.log(`Instructions: ${paths.instructionsFile}`);
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Step 3: Read changeset and determine action
// ---------------------------------------------------------------------------
const changeset = JSON.parse(readFile(paths.changesetFile));

const hasChanges = changeset.modified.length > 0 || changeset.added.length > 0 || changeset.deleted.length > 0;

if (!hasChanges) {
  // No changes detected — nothing to do
  const instructions = {
    mode: 'NO_CHANGES',
    reason: 'Scenario matches existing spec — no changes detected',
    enrichedFile: enrichedPath,
    partialEnrichedFile: null,
    changeset,
    preserveFiles: [specPath],
    timestamp: new Date().toISOString(),
  };
  fs.writeFileSync(paths.instructionsFile, JSON.stringify(instructions, null, 2));
  console.log('Mode: NO_CHANGES (scenario matches spec)');
  console.log(`Instructions: ${paths.instructionsFile}`);
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Step 4: Create partial enriched.md with ONLY changed/added steps
// ---------------------------------------------------------------------------
const enrichedContent = readFile(enrichedPath);
const enrichedLines = enrichedContent.split('\n');

// Extract metadata and headers (everything before ## Steps)
const stepsHeaderIndex = enrichedLines.findIndex(l => /^##\s+Steps/i.test(l.trim()));
const header = stepsHeaderIndex >= 0 ? enrichedLines.slice(0, stepsHeaderIndex + 1).join('\n') : '';

// Collect changed step positions
const changedPositions = new Set();
changeset.modified.forEach(s => changedPositions.add(s.position));
changeset.added.forEach(s => changedPositions.add(s.position));

// Extract ONLY the changed steps from the enriched file
// Also include context: the page section header for each changed step
const partialLines = [
  '# PARTIAL ENRICHED — Changed Steps Only',
  '# Generated by builder-incremental.js — DO NOT EDIT',
  `# Full enriched file: ${enrichedPath}`,
  `# Changeset: ${changeset.summary}`,
  '',
  '## Metadata (from full enriched)',
  // Copy metadata section
];

// Find and copy metadata
const metadataStart = enrichedLines.findIndex(l => /^##\s+Metadata/i.test(l.trim()));
const metadataEnd = enrichedLines.findIndex((l, i) => i > metadataStart && /^##\s+/.test(l.trim()));
if (metadataStart >= 0) {
  const end = metadataEnd >= 0 ? metadataEnd : stepsHeaderIndex;
  partialLines.push(...enrichedLines.slice(metadataStart, end));
}

partialLines.push('', '## Changed Steps', '');

// For each changed/added step, include the step and its page section header
let currentSection = '';
let inStepSection = false;

for (let i = 0; i < enrichedLines.length; i++) {
  const line = enrichedLines[i];
  const trimmed = line.trim();

  // Track page section headers
  if (trimmed.startsWith('### ') && !trimmed.startsWith('### Scenario:')) {
    currentSection = trimmed;
    continue;
  }

  // Check if this is a numbered step
  const stepMatch = trimmed.match(/^(\d+)\.\s+/);
  if (stepMatch) {
    const stepNum = parseInt(stepMatch[1], 10);

    // Use positional counting instead of user step numbers
    // (step numbers in .md may be wrong, but scenario-diff uses positional)
    // For simplicity, match by step number
    if (changedPositions.has(stepNum)) {
      // Include the section header if we haven't already
      if (currentSection) {
        partialLines.push('', currentSection);
        currentSection = ''; // Only include once per section
      }

      // Include the step and any continuation lines (comments, LOCATOR annotations)
      partialLines.push(line);

      // Include continuation lines (indented or comment lines following the step)
      for (let j = i + 1; j < enrichedLines.length; j++) {
        const nextLine = enrichedLines[j];
        const nextTrimmed = nextLine.trim();
        if (nextTrimmed.startsWith('<!--') || nextLine.startsWith('   ') || nextLine.startsWith('\t')) {
          partialLines.push(nextLine);
        } else {
          break;
        }
      }
    }
  }
}

// Add deleted steps info
if (changeset.deleted.length > 0) {
  partialLines.push('', '## Deleted Steps (remove from spec)', '');
  changeset.deleted.forEach(s => {
    partialLines.push(`- Position ${s.position}: "${s.text}" → REMOVE from spec (comment out with // REMOVED)`);
  });
}

// Add test data section if it exists
const testDataStart = enrichedLines.findIndex(l => /^##\s+Test Data/i.test(l.trim()));
if (testDataStart >= 0) {
  const testDataEnd = enrichedLines.findIndex((l, i) => i > testDataStart && /^##\s+/.test(l.trim()) && !/Test Data/i.test(l));
  const end = testDataEnd >= 0 ? testDataEnd : enrichedLines.length;
  partialLines.push('', ...enrichedLines.slice(testDataStart, end));
}

const partialContent = partialLines.join('\n');
fs.writeFileSync(paths.partialEnrichedFile, partialContent, 'utf-8');

// ---------------------------------------------------------------------------
// Step 5: Generate builder instructions
// ---------------------------------------------------------------------------

// Collect files that must NOT be overwritten
const preserveFiles = [];

// Find all page object files
const pagesDir = path.join(outputDir, 'pages');
if (fileExists(pagesDir)) {
  fs.readdirSync(pagesDir)
    .filter(f => f.endsWith('.ts') || f.endsWith('.js'))
    .forEach(f => preserveFiles.push(path.join(pagesDir, f)));
}

// The spec file itself (Builder should modify, not recreate)
preserveFiles.push(specPath);

// Locator files (NEVER overwrite — Scout and Executor own these)
const locatorsDir = path.join(outputDir, 'locators');
if (fileExists(locatorsDir)) {
  fs.readdirSync(locatorsDir)
    .filter(f => f.endsWith('.locators.json'))
    .forEach(f => preserveFiles.push(path.join(locatorsDir, f)));
}

const instructions = {
  mode: 'INCREMENTAL',
  reason: changeset.summary,
  enrichedFile: enrichedPath,
  partialEnrichedFile: paths.partialEnrichedFile,
  specFile: specPath,
  changeset: {
    summary: changeset.summary,
    unchangedCount: changeset.unchanged.length,
    modifiedCount: changeset.modified.length,
    addedCount: changeset.added.length,
    deletedCount: changeset.deleted.length,
    modified: changeset.modified,
    added: changeset.added,
    deleted: changeset.deleted,
    // DO NOT include unchanged steps — Builder should not see them
  },
  preserveFiles,
  rules: [
    'READ the existing spec file FIRST — understand its structure',
    'MODIFY ONLY the steps listed in changeset.modified',
    'ADD ONLY the steps listed in changeset.added',
    'COMMENT OUT (// REMOVED) the steps listed in changeset.deleted',
    'DO NOT TOUCH steps not in the changeset — they are UNCHANGED',
    'PRESERVE all // HEALED comments and selectors',
    'PRESERVE all // PACING comments and waits',
    'DO NOT recreate the spec file from scratch',
    'DO NOT overwrite locator JSON files',
    'ADD new page object methods if needed — DO NOT recreate page objects',
  ],
  timestamp: new Date().toISOString(),
};

fs.writeFileSync(paths.instructionsFile, JSON.stringify(instructions, null, 2));

console.log(`\nMode: INCREMENTAL`);
console.log(`Changes: ${changeset.summary}`);
console.log(`Partial enriched: ${paths.partialEnrichedFile}`);
console.log(`Instructions: ${paths.instructionsFile}`);
console.log(`\nBuilder should read ${paths.instructionsFile} FIRST before generating code.`);
