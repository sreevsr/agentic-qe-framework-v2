#!/usr/bin/env node

/**
 * builder-incremental.js — Annotate enriched.md + produce builder-instructions.json
 *
 * DESIGN PRINCIPLE: Scripts for evidence, LLMs for judgment.
 * This script annotates the enriched.md in-place with <!-- CHANGE: --> and <!-- WALK: -->
 * markers so the Explorer and Builder know exactly what changed. No partial files.
 *
 * Usage:
 *   node scripts/builder-incremental.js --scenario=<name> --type=<web|api|hybrid> [--folder=<folder>]
 *
 * Prerequisites:
 *   - scenario-diff.js must have been run first (produces classified-changeset.json)
 *   - OR this script runs it automatically if the changeset is missing
 *
 * What it does:
 *   1. Reads classified-changeset.json (from scenario-diff.js)
 *   2. If FIRST_RUN or NO_CHANGES → writes builder-instructions.json and exits
 *   3. For INCREMENTAL/EXPLORER_REQUIRED/BUILDER_ONLY:
 *      a. Reads the enriched.md file
 *      b. Injects <!-- CHANGE: --> and <!-- WALK: --> annotations on each step
 *      c. Marks deleted steps with strikethrough
 *      d. Inserts new steps from scenario.md at correct positions
 *      e. Writes annotated enriched.md back (in-place)
 *      f. Writes builder-instructions.json
 *
 * Output:
 *   - scenarios/{type}/{scenario}.enriched.md (annotated in-place)
 *   - output/reports/builder-instructions.json
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { parseSections, normalizeStep } = require('./lib/section-parser');

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
  scenarioFile: path.join(projectRoot, 'scenarios', type, folderPrefix, `${scenario}.md`),
  enrichedFile: path.join(projectRoot, 'scenarios', type, folderPrefix, `${scenario}.enriched.md`),
  specFile: path.join(outputDir, 'tests', type, folderPrefix, `${scenario}.spec.ts`),
  specFileJs: path.join(outputDir, 'tests', type, folderPrefix, `${scenario}.spec.js`),
  changesetFile: path.join(outputDir, 'reports', 'classified-changeset.json'),
  instructionsFile: path.join(outputDir, 'reports', 'builder-instructions.json'),
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function fileExists(p) { return fs.existsSync(p); }
function readFile(p) { return fs.readFileSync(p, 'utf-8'); }
function writeJson(p, data) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2));
}

// ---------------------------------------------------------------------------
// Step 1: Ensure classified-changeset.json exists
// ---------------------------------------------------------------------------
if (!fileExists(paths.changesetFile)) {
  const enrichedPath = fileExists(paths.enrichedFile) ? paths.enrichedFile : paths.scenarioFile;
  const specPath = fileExists(paths.specFile) ? paths.specFile : (fileExists(paths.specFileJs) ? paths.specFileJs : null);

  if (!specPath) {
    // No existing spec → FIRST_RUN (full generation)
    writeJson(paths.instructionsFile, {
      mode: 'FULL',
      pipelineMode: 'FIRST_RUN',
      reason: 'No existing spec file found — full generation required',
      enrichedFile: enrichedPath,
      changeset: null,
      preserveHealedCode: false,
      timestamp: new Date().toISOString(),
    });
    console.log('Mode: FULL (no existing spec)');
    console.log(`Instructions: ${paths.instructionsFile}`);
    process.exit(0);
  }

  // Run scenario-diff.js to produce the changeset
  console.log('Running scenario-diff.js...');
  try {
    execSync(
      `node "${path.join(projectRoot, 'scripts', 'scenario-diff.js')}" --scenario="${enrichedPath}" --spec="${specPath}" --output="${paths.changesetFile}"`,
      { stdio: 'pipe' }
    );
  } catch (err) {
    console.error(`scenario-diff.js failed: ${err.message}`);
    writeJson(paths.instructionsFile, {
      mode: 'FULL',
      pipelineMode: 'FIRST_RUN',
      reason: `scenario-diff.js failed — falling back to full generation: ${err.message}`,
      enrichedFile: enrichedPath,
      changeset: null,
      preserveHealedCode: false,
      timestamp: new Date().toISOString(),
    });
    console.log('Mode: FULL (scenario-diff failed, fallback)');
    process.exit(0);
  }
}

// ---------------------------------------------------------------------------
// Step 2: Read changeset
// ---------------------------------------------------------------------------
const changeset = JSON.parse(readFile(paths.changesetFile));

// ---------------------------------------------------------------------------
// Step 3: Handle NO_CHANGES and FIRST_RUN early exits
// ---------------------------------------------------------------------------
if (changeset.pipelineMode === 'NO_CHANGES') {
  writeJson(paths.instructionsFile, {
    mode: 'NO_CHANGES',
    pipelineMode: 'NO_CHANGES',
    reason: 'Scenario matches existing spec — no changes detected',
    enrichedFile: fileExists(paths.enrichedFile) ? paths.enrichedFile : paths.scenarioFile,
    changeset: changeset.summary,
    preserveHealedCode: true,
    timestamp: new Date().toISOString(),
  });
  console.log('Mode: NO_CHANGES (scenario matches spec)');
  console.log(`Instructions: ${paths.instructionsFile}`);
  process.exit(0);
}

if (changeset.pipelineMode === 'FIRST_RUN') {
  writeJson(paths.instructionsFile, {
    mode: 'FULL',
    pipelineMode: 'FIRST_RUN',
    reason: 'First run — full generation required',
    enrichedFile: fileExists(paths.enrichedFile) ? paths.enrichedFile : paths.scenarioFile,
    changeset: changeset.summary,
    preserveHealedCode: false,
    timestamp: new Date().toISOString(),
  });
  console.log('Mode: FULL (first run)');
  console.log(`Instructions: ${paths.instructionsFile}`);
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Step 4: Annotate the enriched.md in-place
// ---------------------------------------------------------------------------
const enrichedPath = fileExists(paths.enrichedFile) ? paths.enrichedFile : paths.scenarioFile;
if (!fileExists(enrichedPath)) {
  console.error(`Enriched file not found: ${enrichedPath}`);
  process.exit(1);
}

const enrichedContent = readFile(enrichedPath);
const enrichedParsed = parseSections(enrichedContent);
const enrichedLines = enrichedContent.split('\n');

// Build a lookup: for each section, map step positions to their change info
const changeLookup = buildChangeLookup(changeset.sections, enrichedParsed.sections);

// Annotate lines
const annotatedLines = [];
let currentSectionName = null;
const sectionStepCounters = {}; // tracks section-relative step position (1-based)
const annotatedAddedPositions = {}; // tracks which ADDED positions were already annotated in-place

for (let i = 0; i < enrichedLines.length; i++) {
  const line = enrichedLines[i];
  const trimmed = line.trim();

  // Track section transitions
  const sectionInfo = findSectionAtLine(i, enrichedParsed.sections);
  if (sectionInfo) currentSectionName = sectionInfo.name;

  // Check if this line is a numbered step
  const stepMatch = trimmed.match(/^(\d+)\.\s+/);
  if (stepMatch && currentSectionName) {
    // Use section-relative position (1st step in section = 1, 2nd = 2, etc.)
    // NOT the global step number written in the .md file
    if (!sectionStepCounters[currentSectionName]) sectionStepCounters[currentSectionName] = 0;
    sectionStepCounters[currentSectionName]++;
    const sectionRelativePosition = sectionStepCounters[currentSectionName];
    const changeInfo = getChangeInfo(currentSectionName, sectionRelativePosition, changeLookup);

    if (changeInfo) {
      if (changeInfo.type === 'deleted') {
        // Mark deleted step with strikethrough
        annotatedLines.push(`~~${line}~~`);
        annotatedLines.push(`   <!-- CHANGE: DELETED -->`);
        annotatedLines.push(`   <!-- WALK: SKIP -->`);
        // Skip continuation lines (existing annotations for this step)
        i = skipContinuationLines(enrichedLines, i);
        continue;
      }

      // Add the step line
      annotatedLines.push(line);

      // Add existing continuation lines (LOCATOR, MISSING ELEMENT, etc.)
      const contEnd = findContinuationEnd(enrichedLines, i);
      for (let j = i + 1; j <= contEnd; j++) {
        // Skip any previous CHANGE/WALK annotations (from a prior run)
        if (!isIncrementalAnnotation(enrichedLines[j])) {
          annotatedLines.push(enrichedLines[j]);
        }
      }

      // Add change and walk annotations
      annotatedLines.push(`   <!-- CHANGE: ${changeInfo.changeType}${changeInfo.detail ? ' | ' + changeInfo.detail : ''} -->`);
      annotatedLines.push(`   <!-- WALK: ${changeInfo.walkMode}${changeInfo.walkReason ? ' — ' + changeInfo.walkReason : ''} -->`);

      // Track ADDED positions that were annotated in-place (already exist in enriched.md)
      if (changeInfo.type === 'added') {
        if (!annotatedAddedPositions[currentSectionName]) annotatedAddedPositions[currentSectionName] = new Set();
        annotatedAddedPositions[currentSectionName].add(sectionRelativePosition);
      }

      i = contEnd;
      continue;
    }
  }

  // Non-step lines or unchanged steps — pass through (strip old annotations)
  if (!isIncrementalAnnotation(line)) {
    annotatedLines.push(line);
  }
}

// Insert added steps — but only those NOT already annotated in-place
const addedSteps = collectAddedSteps(changeset.sections, enrichedParsed)
  .filter(a => {
    const handled = annotatedAddedPositions[a.sectionName];
    return !(handled && handled.has(a.position));
  });
if (addedSteps.length > 0) {
  insertAddedSteps(annotatedLines, addedSteps, enrichedParsed);
}

// Write annotated enriched.md
fs.writeFileSync(enrichedPath, annotatedLines.join('\n'), 'utf-8');
console.log(`Annotated: ${enrichedPath}`);

// ---------------------------------------------------------------------------
// Step 5: Write builder instructions
// ---------------------------------------------------------------------------
const specPath = fileExists(paths.specFile) ? paths.specFile : (fileExists(paths.specFileJs) ? paths.specFileJs : null);

const instructions = {
  mode: 'INCREMENTAL',
  pipelineMode: changeset.pipelineMode,
  reason: changeset.summary,
  enrichedFile: enrichedPath,
  specFile: specPath,
  changeset: {
    summary: changeset.summary,
    totalSteps: changeset.totalSteps,
    affectedScenarios: changeset.affectedScenarios,
    sections: changeset.sections.map(s => ({
      name: s.name,
      sectionWalkMode: s.sectionWalkMode,
      modifiedCount: s.modified.length,
      addedCount: s.added.length,
      deletedCount: s.deleted.length,
      unchangedCount: s.unchanged.length,
    })),
  },
  preserveHealedCode: true,
  rules: [
    'READ the existing spec file FIRST — understand its structure',
    'Look for <!-- CHANGE: --> annotations in the enriched.md',
    'MODIFY ONLY steps marked CHANGE: MODIFIED',
    'ADD steps marked CHANGE: ADDED at the indicated position',
    'REMOVE steps marked CHANGE: DELETED (comment out with // REMOVED)',
    'DO NOT TOUCH steps without CHANGE annotations — they are UNCHANGED',
    'PRESERVE all // HEALED comments and selectors from Executor',
    'PRESERVE all // PACING comments and waits from Executor',
    'DO NOT recreate the spec file from scratch',
    'DO NOT overwrite locator JSON files',
    'ADD new page object methods if needed — DO NOT recreate page objects',
  ],
  timestamp: new Date().toISOString(),
};

writeJson(paths.instructionsFile, instructions);

console.log(`\nMode: INCREMENTAL (${changeset.pipelineMode})`);
console.log(`Changes: ${changeset.summary}`);
console.log(`Instructions: ${paths.instructionsFile}`);

// ---------------------------------------------------------------------------
// Annotation helper functions
// ---------------------------------------------------------------------------

/**
 * Build a lookup structure: sectionName → stepPosition → changeInfo
 */
function buildChangeLookup(changesetSections, enrichedSections) {
  const lookup = {};

  for (const cs of changesetSections) {
    const sectionKey = cs.name;
    lookup[sectionKey] = {};

    for (const m of cs.modified) {
      lookup[sectionKey][m.position] = {
        type: 'modified',
        changeType: 'MODIFIED',
        detail: `OLD: ${m.oldText}`,
        walkMode: m.walkMode,
        walkReason: m.classification === 'BUILDER_ONLY' ? 'unchanged interaction, value-only change' : 'interaction target changed',
        classification: m.classification,
      };
    }

    for (const d of cs.deleted) {
      lookup[sectionKey][d.position] = {
        type: 'deleted',
        changeType: 'DELETED',
        detail: null,
        walkMode: 'SKIP',
        walkReason: 'step removed from scenario',
        classification: 'BUILDER_ONLY',
      };
    }

    for (const u of cs.unchanged) {
      lookup[sectionKey][u.position] = {
        type: 'unchanged',
        changeType: 'UNCHANGED',
        detail: null,
        walkMode: u.walkMode || 'SKIP',
        walkReason: u.walkMode === 'FAST' ? 'unchanged, execute for state only' : 'unchanged, no exploration needed',
        classification: 'NO_ACTION',
      };
    }
  }

  return lookup;
}

/**
 * Find which section a line belongs to.
 */
function findSectionAtLine(lineNum, sections) {
  for (const s of sections) {
    if (lineNum >= s.startLine && (s.endLine === null || lineNum <= s.endLine)) {
      return s;
    }
  }
  return null;
}

/**
 * Get change info for a step in a section.
 */
function getChangeInfo(sectionName, stepPosition, lookup) {
  // Try exact section name match
  if (lookup[sectionName] && lookup[sectionName][stepPosition]) {
    return lookup[sectionName][stepPosition];
  }

  // Try matching by section type for lifecycle sections
  for (const key of Object.keys(lookup)) {
    if (normalizeStep(key) === normalizeStep(sectionName)) {
      if (lookup[key][stepPosition]) return lookup[key][stepPosition];
    }
  }

  return null;
}

/**
 * Skip continuation lines after a step (annotations, indented text).
 * Returns the last line index that belongs to this step.
 */
function skipContinuationLines(lines, stepLineIndex) {
  let j = stepLineIndex;
  for (let k = stepLineIndex + 1; k < lines.length; k++) {
    const next = lines[k].trim();
    if (next.startsWith('<!--') || lines[k].startsWith('   ') || lines[k].startsWith('\t') ||
        (next === '' && k + 1 < lines.length && lines[k + 1].trim().startsWith('<!--'))) {
      j = k;
    } else {
      break;
    }
  }
  return j;
}

/**
 * Find the end of continuation lines for a step.
 */
function findContinuationEnd(lines, stepLineIndex) {
  let end = stepLineIndex;
  for (let k = stepLineIndex + 1; k < lines.length; k++) {
    const next = lines[k].trim();
    if (next.startsWith('<!--') || lines[k].startsWith('   ') || lines[k].startsWith('\t') ||
        (next === '' && k + 1 < lines.length && lines[k + 1].trim().startsWith('<!--'))) {
      end = k;
    } else {
      break;
    }
  }
  return end;
}

/**
 * Check if a line is an incremental annotation (from a prior run).
 */
function isIncrementalAnnotation(line) {
  const trimmed = line.trim();
  return /^<!--\s*CHANGE:/.test(trimmed) || /^<!--\s*WALK:/.test(trimmed);
}

/**
 * Collect all added steps from the changeset, with their source text from scenario.md.
 */
function collectAddedSteps(changesetSections) {
  const added = [];
  for (const cs of changesetSections) {
    for (const a of cs.added) {
      added.push({
        sectionName: cs.name,
        position: a.position,
        text: a.text,
        walkMode: a.walkMode,
        classification: a.classification,
      });
    }
  }
  return added;
}

/**
 * Insert added steps into the annotated lines at their correct positions.
 *
 * Strategy: Added steps have a `position` (section-relative). We find the Nth step
 * in the matching section of the annotated lines and insert AFTER the (position-1)th step.
 * For position 1, insert before the first step. For position > existing count, append at end.
 */
function insertAddedSteps(lines, addedSteps, enrichedParsed) {
  // Group by section, sort by position descending (insert from bottom up to avoid index shift)
  const bySectionName = {};
  for (const a of addedSteps) {
    if (!bySectionName[a.sectionName]) bySectionName[a.sectionName] = [];
    bySectionName[a.sectionName].push(a);
  }

  const insertions = [];

  for (const [sectionName, steps] of Object.entries(bySectionName)) {
    const section = enrichedParsed.sections.find(s =>
      s.name === sectionName || normalizeStep(s.name) === normalizeStep(sectionName));

    if (!section) {
      // New section entirely — append at end of file
      const newLines = ['', `### ${sectionName}`, ''];
      for (const step of steps) {
        newLines.push(`${step.position}. ${step.text}`);
        newLines.push(`   <!-- CHANGE: ADDED -->`);
        newLines.push(`   <!-- WALK: ${step.walkMode} — new step, never verified -->`);
      }
      insertions.push({ lineIndex: lines.length, newLines });
      continue;
    }

    // Build a map of section-relative step positions to their line indices in the annotated output
    // We need to count steps in the annotated lines that belong to this section
    const sectionStepLines = []; // [{lineIndex, endLineIndex}] — one per step in this section
    let inSection = false;
    let stepCount = 0;

    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim();

      // Detect section boundaries using the section's start line content
      // Since lines may have shifted due to annotations, match by section header text
      if (section.rawLines[0] && trimmed === section.rawLines[0].trim()) {
        inSection = true;
        continue;
      }

      // Detect when we leave the section (another ## or ### Scenario: header)
      if (inSection && (/^##\s+/.test(trimmed) || /^###\s+Scenario:/i.test(trimmed)) &&
          trimmed !== section.rawLines[0]?.trim()) {
        break;
      }

      // Count steps (including strikethrough deleted steps)
      if (inSection && (/^\d+\.\s+/.test(trimmed) || /^~~\d+\.\s+/.test(trimmed))) {
        stepCount++;
        // Find end of this step's continuation lines
        let endIdx = i;
        for (let k = i + 1; k < lines.length; k++) {
          const next = lines[k].trim();
          if (next.startsWith('<!--') || lines[k].startsWith('   ') || lines[k].startsWith('\t')) {
            endIdx = k;
          } else {
            break;
          }
        }
        sectionStepLines.push({ lineIndex: i, endLineIndex: endIdx, position: stepCount });
      }
    }

    // Sort added steps by position descending (insert from bottom up)
    const sortedSteps = [...steps].sort((a, b) => b.position - a.position);

    for (const step of sortedSteps) {
      const newLines = [
        `${step.position}. ${step.text}`,
        `   <!-- CHANGE: ADDED -->`,
        `   <!-- WALK: ${step.walkMode} — new step, never verified -->`,
      ];

      // Find insertion point
      let insertIdx;
      if (step.position <= 1) {
        // Insert before the first step in the section
        insertIdx = sectionStepLines.length > 0 ? sectionStepLines[0].lineIndex : lines.length;
      } else {
        // Insert after the step at position-1
        const prevStep = sectionStepLines.find(s => s.position === step.position - 1);
        if (prevStep) {
          insertIdx = prevStep.endLineIndex + 1;
        } else {
          // Fallback: after the last step in section
          const lastStep = sectionStepLines[sectionStepLines.length - 1];
          insertIdx = lastStep ? lastStep.endLineIndex + 1 : lines.length;
        }
      }

      insertions.push({ lineIndex: insertIdx, newLines });
    }
  }

  // Apply insertions in reverse order (highest line index first)
  insertions.sort((a, b) => b.lineIndex - a.lineIndex);
  for (const ins of insertions) {
    lines.splice(ins.lineIndex, 0, ...ins.newLines);
  }
}
