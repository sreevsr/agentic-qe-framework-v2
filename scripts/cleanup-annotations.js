#!/usr/bin/env node

/**
 * cleanup-annotations.js — Strip incremental markers from enriched.md after Builder runs
 *
 * Removes <!-- CHANGE: --> and <!-- WALK: --> annotations injected by builder-incremental.js,
 * removes DELETED steps entirely, and renumbers steps per section.
 *
 * Usage:
 *   node scripts/cleanup-annotations.js --file=<path-to-enriched.md>
 *
 * Run this AFTER the Builder completes. Produces a clean enriched.md ready for the next cycle.
 * Also cleans up builder-instructions.json and classified-changeset.json.
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------
const args = {};
process.argv.slice(2).forEach(arg => {
  const match = arg.match(/^--([\w-]+)=(.+)$/);
  if (match) args[match[1]] = match[2];
});

const filePath = args.file;
if (!filePath) {
  console.error('Usage: node scripts/cleanup-annotations.js --file=<path-to-enriched.md>');
  process.exit(1);
}
if (!fs.existsSync(filePath)) {
  console.error(`File not found: ${filePath}`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Read and process
// ---------------------------------------------------------------------------
const content = fs.readFileSync(filePath, 'utf-8');
const lines = content.split('\n');
const cleanedLines = [];

let deletedStepActive = false;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const trimmed = line.trim();

  // Skip incremental annotations
  if (/^<!--\s*CHANGE:\s*/i.test(trimmed) || /^<!--\s*WALK:\s*/i.test(trimmed)) {
    continue;
  }

  // Detect deleted step (strikethrough line)
  if (/^~~\d+\.\s+/.test(trimmed)) {
    deletedStepActive = true;
    continue;
  }

  // Skip continuation lines of a deleted step
  if (deletedStepActive) {
    if (trimmed.startsWith('<!--') || line.startsWith('   ') || line.startsWith('\t') || trimmed === '') {
      continue;
    }
    deletedStepActive = false;
  }

  cleanedLines.push(line);
}

// ---------------------------------------------------------------------------
// Remove orphaned duplicate steps
// After annotation stripping, steps that were pushed down by insertions may
// remain as duplicates (same text as a nearby step). Remove exact duplicates.
// ---------------------------------------------------------------------------
const deduped = removeDuplicateSteps(cleanedLines);

// ---------------------------------------------------------------------------
// Renumber steps within each section
// ---------------------------------------------------------------------------
const renumbered = renumberSteps(deduped);

// ---------------------------------------------------------------------------
// Write cleaned file
// ---------------------------------------------------------------------------
fs.writeFileSync(filePath, renumbered.join('\n'), 'utf-8');
console.log(`Cleaned: ${filePath}`);
console.log(`  - Removed CHANGE/WALK annotations`);
console.log(`  - Removed deleted steps`);
console.log(`  - Renumbered steps per section`);

// ---------------------------------------------------------------------------
// Clean up temporary report files
// ---------------------------------------------------------------------------
const projectRoot = path.resolve(__dirname, '..');
const reportsDir = path.join(projectRoot, 'output', 'reports');

const tempFiles = [
  path.join(reportsDir, 'classified-changeset.json'),
  path.join(reportsDir, 'builder-instructions.json'),
];

for (const f of tempFiles) {
  if (fs.existsSync(f)) {
    fs.unlinkSync(f);
    console.log(`  - Deleted: ${path.basename(f)}`);
  }
}

// Also delete any leftover partial enriched files from old builder-incremental.js
const reportsContents = fs.existsSync(reportsDir) ? fs.readdirSync(reportsDir) : [];
for (const f of reportsContents) {
  if (f.endsWith('-partial-enriched.md')) {
    fs.unlinkSync(path.join(reportsDir, f));
    console.log(`  - Deleted legacy: ${f}`);
  }
}

// ---------------------------------------------------------------------------
// Deduplication logic
// ---------------------------------------------------------------------------

/**
 * Remove duplicate steps that appear consecutively (within 3 lines) with the same text.
 * This handles orphaned steps left behind when builder-incremental.js inserts ADDED
 * steps but the original step at that position was already in the file.
 */
function removeDuplicateSteps(lines) {
  const result = [];
  const recentStepTexts = []; // sliding window of recent step texts

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    const stepMatch = trimmed.match(/^(\d+)\.\s+(.+)$/);

    if (stepMatch) {
      const stepText = stepMatch[2].replace(/<!--.*?-->/g, '').trim();
      const normalized = stepText.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();

      // Check if this step text appeared in the last 3 steps
      const isDuplicate = recentStepTexts.some(s => s === normalized);
      if (isDuplicate) {
        // Skip this line and its continuation lines
        for (let j = i + 1; j < lines.length; j++) {
          const next = lines[j].trim();
          if (next.startsWith('<!--') || lines[j].startsWith('   ') || lines[j].startsWith('\t')) {
            i = j; // skip continuation
          } else {
            break;
          }
        }
        continue;
      }

      recentStepTexts.push(normalized);
      if (recentStepTexts.length > 5) recentStepTexts.shift(); // keep window small
    }

    result.push(line);
  }

  return result;
}

// ---------------------------------------------------------------------------
// Renumbering logic
// ---------------------------------------------------------------------------

/**
 * Renumber steps sequentially within each section.
 *
 * Sections are delimited by ## or ### headings. Within each section,
 * numbered steps (N. text) are renumbered 1, 2, 3, ...
 *
 * For multi-scenario files with global numbering (Common Setup 1-3,
 * Scenario A 4-10, Scenario B 11-15), renumbering is WITHIN-SECTION
 * so each section starts at 1. This matches how the Builder uses
 * positional step references.
 *
 * For single-scenario files (## Steps), numbering continues globally
 * across page section headers (### PageName).
 */
function renumberSteps(lines) {
  const result = [];
  let stepCounter = 0;
  let isMultiScenario = false;

  // Detect multi-scenario: look for ### Scenario: headers
  for (const line of lines) {
    if (/^###\s+Scenario:/i.test(line.trim())) {
      isMultiScenario = true;
      break;
    }
  }

  for (const line of lines) {
    const trimmed = line.trim();

    // Reset counter on section boundaries for multi-scenario files
    if (isMultiScenario) {
      if (/^##\s+Common Setup Once/i.test(trimmed) ||
          /^##\s+Common Setup\s*$/i.test(trimmed) ||
          /^###\s+Scenario:/i.test(trimmed) ||
          /^##\s+Common Teardown\s*$/i.test(trimmed) ||
          /^##\s+Common Teardown Once/i.test(trimmed)) {
        stepCounter = 0;
      }
    } else {
      // Single-scenario: reset only on ## Steps
      if (/^##\s+Steps/i.test(trimmed)) {
        stepCounter = 0;
      }
      // ### PageName headers do NOT reset numbering in single-scenario files
    }

    // Renumber steps
    const stepMatch = trimmed.match(/^(\d+)\.\s+(.+)$/);
    if (stepMatch) {
      stepCounter++;
      const indent = line.match(/^(\s*)/)[1];
      result.push(`${indent}${stepCounter}. ${stepMatch[2]}`);
    } else {
      result.push(line);
    }
  }

  return result;
}
