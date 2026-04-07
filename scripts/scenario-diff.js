#!/usr/bin/env node

/**
 * scenario-diff.js — Section-aware diff + change classification for incremental pipeline
 *
 * Compares a scenario/enriched .md file against an existing spec file.
 * Produces a classified changeset that tells the Orchestrator:
 *   - pipelineMode: FIRST_RUN | NO_CHANGES | BUILDER_ONLY | EXPLORER_REQUIRED
 *   - Per-section diffs with step-level change tracking
 *   - Per-step walk mode for Explorer: FAST | DEEP | SKIP
 *
 * Usage:
 *   node scripts/scenario-diff.js --scenario=<path> [--spec=<path>] [--enriched=<path>] [--output=<path>]
 *
 * Comparison strategy (in priority order):
 *   1. If --enriched is provided and exists → compare scenario .md against enriched .md
 *      (enriched.md preserves original step text, so matching is exact)
 *   2. Else auto-detect: look for {scenario}.enriched.md next to the scenario file
 *   3. Else fall back to --spec comparison (step labels may be paraphrased by Builder)
 *
 * Handles multi-scenario files:
 *   ## Common Setup Once, ## Common Setup, ### Scenario: X, ## Common Teardown, etc.
 *   Compares within sections — adding steps to Scenario A does NOT shift Scenario B.
 *
 * Classification rules (deterministic, no LLM):
 *   - VERIFY/CAPTURE expected value changed → BUILDER_ONLY (element exists, just text)
 *   - Interaction target changed → EXPLORER_REQUIRED (different element, must verify)
 *   - New step added → EXPLORER_REQUIRED (never verified)
 *   - Step deleted → BUILDER_ONLY (just remove code)
 *   - Teardown step changed → BUILDER_ONLY (doesn't affect scenario state)
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { parseSections, parseSpecBlocks, normalizeStep } = require('./lib/section-parser');

const ROOT = path.resolve(__dirname, '..');

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------
const args = {};
process.argv.slice(2).forEach(arg => {
  const match = arg.match(/^--([\w-]+)=(.+)$/);
  if (match) args[match[1]] = match[2];
});

const scenarioFile = args.scenario;
if (!scenarioFile) {
  console.error('Usage: node scripts/scenario-diff.js --scenario=<path> [--spec=<path>] [--enriched=<path>] [--output=<path>]');
  process.exit(1);
}
if (!fs.existsSync(scenarioFile)) {
  console.error(`Not found: ${scenarioFile}`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Parse scenario file
// ---------------------------------------------------------------------------
const scenarioContent = fs.readFileSync(scenarioFile, 'utf-8');
const scenarioParsed = parseSections(scenarioContent);

// ---------------------------------------------------------------------------
// Resolve comparison target: enriched.md (preferred) or spec (fallback)
// Enriched.md preserves original step text — matching is exact.
// Spec has paraphrased step labels from the Builder — matching is lossy.
// ---------------------------------------------------------------------------
let comparisonMode = 'none'; // 'enriched' | 'spec' | 'none'
let enrichedParsed = null;
let specBlocks = { blocks: [] };
const specFile = args.spec;

// Priority 1: explicit --enriched flag
let enrichedFile = args.enriched;

// Priority 2: auto-detect enriched.md next to the scenario file
if (!enrichedFile) {
  const scenarioDir = path.dirname(scenarioFile);
  const scenarioBase = path.basename(scenarioFile, '.md');
  const autoEnriched = path.join(scenarioDir, `${scenarioBase}.enriched.md`);
  if (fs.existsSync(autoEnriched)) {
    enrichedFile = autoEnriched;
  }
}

if (enrichedFile && fs.existsSync(enrichedFile)) {
  enrichedParsed = parseSections(fs.readFileSync(enrichedFile, 'utf-8'));
  comparisonMode = 'enriched';
  console.log(`[scenario-diff] Comparing against enriched.md: ${enrichedFile}`);
} else if (specFile && fs.existsSync(specFile)) {
  specBlocks = parseSpecBlocks(fs.readFileSync(specFile, 'utf-8'));
  comparisonMode = 'spec';
  console.log(`[scenario-diff] No enriched.md found — falling back to spec: ${specFile}`);
} else {
  comparisonMode = 'none';
}

// ---------------------------------------------------------------------------
// If no comparison target exists, everything is new → FIRST_RUN
// ---------------------------------------------------------------------------
if (comparisonMode === 'none' || (comparisonMode === 'spec' && specBlocks.blocks.length === 0)) {
  const changeset = buildChangeset({
    scenarioFile,
    specFile: specFile || 'none',
    pipelineMode: 'FIRST_RUN',
    sections: scenarioParsed.sections.map(s => ({
      name: s.name,
      type: s.type,
      sectionType: s.sectionType,
      specBlock: s.specBlock,
      unchanged: [],
      modified: [],
      added: s.steps.map(step => ({
        position: step.position,
        text: step.text,
        walkMode: 'DEEP',
        classification: 'EXPLORER_REQUIRED',
      })),
      deleted: [],
      sectionWalkMode: 'DEEP',
    })),
    summary: `FIRST_RUN: All ${scenarioParsed.totalSteps} steps are new (no existing spec)`,
  });
  writeOutput(changeset);
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Match scenario sections to comparison target and diff within each
// ---------------------------------------------------------------------------
const sectionResults = [];

if (comparisonMode === 'enriched') {
  // Enriched mode: compare scenario sections against enriched sections (exact text match)
  const matchedEnrichedSections = new Set();

  for (const section of scenarioParsed.sections) {
    // Find matching enriched section by name and type
    const enrichedSection = findMatchingEnrichedSection(section, enrichedParsed.sections, matchedEnrichedSections);

    if (!enrichedSection) {
      // Entire section is new
      sectionResults.push({
        name: section.name,
        type: section.type,
        sectionType: section.sectionType,
        specBlock: section.specBlock,
        unchanged: [],
        modified: [],
        added: section.steps.map(step => ({
          position: step.position,
          text: step.text,
          walkMode: 'DEEP',
          classification: 'EXPLORER_REQUIRED',
        })),
        deleted: [],
        sectionWalkMode: 'DEEP',
      });
      continue;
    }

    matchedEnrichedSections.add(enrichedSection);

    // Diff steps: compare scenario step texts against enriched step texts
    const enrichedStepTexts = enrichedSection.steps.map(s => s.text);
    const { unchanged, modified, added, deleted } = diffSteps(section.steps, enrichedStepTexts);

    // Classify each change
    const classifiedModified = modified.map(m => classifyChange(m, section));
    const classifiedAdded = added.map(a => {
      if (isTeardownSection(section.sectionType)) {
        return { ...a, walkMode: 'DEEP', classification: 'BUILDER_ONLY' };
      }
      return { ...a, walkMode: 'DEEP', classification: 'EXPLORER_REQUIRED' };
    });
    const classifiedDeleted = deleted.map(d => ({
      ...d,
      walkMode: 'SKIP',
      classification: 'BUILDER_ONLY',
    }));

    const hasExplorerRequired = classifiedModified.some(m => m.classification === 'EXPLORER_REQUIRED') ||
                                 classifiedAdded.some(a => a.classification === 'EXPLORER_REQUIRED');

    let sectionWalkMode = 'SKIP';
    if (hasExplorerRequired) sectionWalkMode = 'FAST';

    sectionResults.push({
      name: section.name,
      type: section.type,
      sectionType: section.sectionType,
      specBlock: section.specBlock,
      unchanged: unchanged.map(u => ({
        position: u.position,
        text: u.text,
        walkMode: hasExplorerRequired ? 'FAST' : 'SKIP',
      })),
      modified: classifiedModified,
      added: classifiedAdded,
      deleted: classifiedDeleted,
      sectionWalkMode,
    });
  }

  // Check for deleted sections (enriched sections with no matching scenario section)
  for (const enrichedSection of enrichedParsed.sections) {
    if (!matchedEnrichedSections.has(enrichedSection)) {
      sectionResults.push({
        name: enrichedSection.name,
        type: enrichedSection.type,
        sectionType: null,
        specBlock: enrichedSection.specBlock,
        unchanged: [],
        modified: [],
        added: [],
        deleted: enrichedSection.steps.map((s, i) => ({
          position: i + 1,
          text: s.text,
          walkMode: 'SKIP',
          classification: 'BUILDER_ONLY',
        })),
        sectionWalkMode: 'SKIP',
        entireSectionDeleted: true,
      });
    }
  }
} else {
  // Spec mode (fallback): compare scenario sections against spec blocks (paraphrased labels)
  const matchedSpecBlocks = new Set();

  for (const section of scenarioParsed.sections) {
    // Find matching spec block
    const specBlock = findMatchingSpecBlock(section, specBlocks.blocks, matchedSpecBlocks);

    if (!specBlock) {
      // Entire section is new (new scenario added, or new lifecycle hook)
      sectionResults.push({
        name: section.name,
        type: section.type,
        sectionType: section.sectionType,
        specBlock: section.specBlock,
        unchanged: [],
        modified: [],
        added: section.steps.map(step => ({
          position: step.position,
          text: step.text,
          walkMode: 'DEEP',
          classification: 'EXPLORER_REQUIRED',
        })),
        deleted: [],
        sectionWalkMode: 'DEEP',
      });
      continue;
    }

    matchedSpecBlocks.add(specBlock);

    // Diff steps within this section
    const { unchanged, modified, added, deleted } = diffSteps(section.steps, specBlock.steps);

  // Classify each change
  const classifiedModified = modified.map(m => classifyChange(m, section));
  const classifiedAdded = added.map(a => {
    // Added teardown steps don't affect scenario state — BUILDER_ONLY
    if (isTeardownSection(section.sectionType)) {
      return { ...a, walkMode: 'DEEP', classification: 'BUILDER_ONLY' };
    }
    return { ...a, walkMode: 'DEEP', classification: 'EXPLORER_REQUIRED' };
  });
  const classifiedDeleted = deleted.map(d => ({
    ...d,
    walkMode: 'SKIP',
    classification: 'BUILDER_ONLY',
  }));

  // Determine section-level walk mode
  const hasExplorerRequired = classifiedModified.some(m => m.classification === 'EXPLORER_REQUIRED') ||
                               classifiedAdded.some(a => a.classification === 'EXPLORER_REQUIRED');
  const hasBuilderOnlyChanges = classifiedModified.some(m => m.classification === 'BUILDER_ONLY') ||
                                 classifiedAdded.some(a => a.classification === 'BUILDER_ONLY') ||
                                 classifiedDeleted.length > 0;
  const hasAnyChanges = hasExplorerRequired || hasBuilderOnlyChanges;

  let sectionWalkMode = 'SKIP'; // no changes → skip entirely
  if (hasExplorerRequired) sectionWalkMode = 'FAST'; // section has EXPLORER_REQUIRED changes → fast-walk to state, deep-verify changed
  // BUILDER_ONLY changes don't need Explorer at all → sectionWalkMode stays SKIP

  sectionResults.push({
    name: section.name,
    type: section.type,
    sectionType: section.sectionType,
    specBlock: section.specBlock,
    unchanged: unchanged.map(u => ({
      position: u.position,
      text: u.text,
      walkMode: hasExplorerRequired ? 'FAST' : 'SKIP',
    })),
    modified: classifiedModified,
    added: classifiedAdded,
    deleted: classifiedDeleted,
    sectionWalkMode,
  });
}

  // Check for deleted sections (spec blocks with no matching scenario section)
  for (const specBlock of specBlocks.blocks) {
    if (!matchedSpecBlocks.has(specBlock)) {
      sectionResults.push({
        name: specBlock.name,
        type: specBlock.type,
        sectionType: null,
        specBlock: specBlock.specBlock,
        unchanged: [],
        modified: [],
        added: [],
        deleted: specBlock.steps.map((text, i) => ({
          position: i + 1,
          text,
          walkMode: 'SKIP',
          classification: 'BUILDER_ONLY',
        })),
        sectionWalkMode: 'SKIP',
        entireSectionDeleted: true,
      });
    }
  }
} // end of enriched vs spec mode branching

// ---------------------------------------------------------------------------
// Determine pipeline mode
// ---------------------------------------------------------------------------
const pipelineMode = determinePipelineMode(sectionResults);
const summary = buildSummary(sectionResults, pipelineMode);

const changeset = buildChangeset({
  scenarioFile,
  specFile,
  pipelineMode,
  sections: sectionResults,
  summary,
});

writeOutput(changeset);

// ---------------------------------------------------------------------------
// Core functions
// ---------------------------------------------------------------------------

/**
 * Match a scenario section to its corresponding enriched section.
 * Both use parseSections() format so names and types match directly.
 */
function findMatchingEnrichedSection(section, enrichedSections, alreadyMatched) {
  for (const es of enrichedSections) {
    if (alreadyMatched.has(es)) continue;

    // Exact name match
    if (section.name === es.name) return es;

    // Lifecycle match by sectionType
    if (section.sectionType === es.sectionType && section.type === 'lifecycle' && es.type === 'lifecycle') {
      return es;
    }
  }

  // Single-scenario match: both have sectionType=steps
  if (section.sectionType === 'steps') {
    const stepsSections = enrichedSections.filter(es => !alreadyMatched.has(es) && es.sectionType === 'steps');
    if (stepsSections.length === 1) return stepsSections[0];
  }

  // Fuzzy match for scenarios
  if (section.type === 'scenario') {
    const sectionName = section.name.replace(/^Scenario:\s*/i, '').trim();
    for (const es of enrichedSections) {
      if (alreadyMatched.has(es)) continue;
      if (es.type !== 'scenario') continue;
      const esName = es.name.replace(/^Scenario:\s*/i, '').trim();
      if (normalizeStep(sectionName) === normalizeStep(esName)) return es;
    }
  }

  return null;
}

/**
 * Match a scenario section to its corresponding spec block.
 */
function findMatchingSpecBlock(section, blocks, alreadyMatched) {
  for (const block of blocks) {
    if (alreadyMatched.has(block)) continue;

    // Exact name match (e.g., "Scenario: Add Item" === "Scenario: Add Item")
    if (section.name === block.name) return block;

    // Lifecycle match (e.g., section.sectionType=commonSetup, block.specBlock=beforeEach)
    if (section.specBlock === block.specBlock && section.type === 'lifecycle' && block.type === 'lifecycle') {
      return block;
    }
  }

  // Single-scenario match: ## Steps (type=lifecycle, specBlock=test) should match
  // test('ScenarioName', ...) (type=scenario, specBlock=test) when there's only one test block
  if (section.sectionType === 'steps' && section.specBlock === 'test') {
    const testBlocks = blocks.filter(b => !alreadyMatched.has(b) && b.specBlock === 'test');
    if (testBlocks.length === 1) return testBlocks[0];
  }

  // Fuzzy match for scenarios (name may have changed slightly)
  if (section.type === 'scenario') {
    const sectionScenarioName = section.name.replace(/^Scenario:\s*/i, '').trim();
    for (const block of blocks) {
      if (alreadyMatched.has(block)) continue;
      if (block.type !== 'scenario') continue;
      const blockScenarioName = block.name.replace(/^Scenario:\s*/i, '').trim();
      if (normalizeStep(sectionScenarioName) === normalizeStep(blockScenarioName)) return block;
    }
  }

  return null;
}

/**
 * Diff steps within a section. Positional comparison within the section scope.
 */
function diffSteps(scenarioSteps, specStepTexts) {
  const unchanged = [];
  const modified = [];
  const added = [];
  const deleted = [];

  const maxLen = Math.max(scenarioSteps.length, specStepTexts.length);

  for (let i = 0; i < maxLen; i++) {
    const scenarioStep = scenarioSteps[i];
    const specStepText = specStepTexts[i];

    if (scenarioStep && specStepText) {
      const ns = normalizeStep(scenarioStep.text);
      const np = normalizeStep(specStepText);
      if (ns === np) {
        unchanged.push({ position: i + 1, text: scenarioStep.text });
      } else {
        modified.push({ position: i + 1, oldText: specStepText, newText: scenarioStep.text });
      }
    } else if (scenarioStep && !specStepText) {
      added.push({ position: i + 1, text: scenarioStep.text });
    } else if (!scenarioStep && specStepText) {
      deleted.push({ position: i + 1, text: specStepText });
    }
  }

  return { unchanged, modified, added, deleted };
}

/**
 * Classify a modified step as EXPLORER_REQUIRED or BUILDER_ONLY.
 *
 * Rules (deterministic):
 *   - If ONLY the VERIFY/CAPTURE expected value changed → BUILDER_ONLY
 *   - If the step is in a teardown section → BUILDER_ONLY
 *   - If the interaction target/action changed → EXPLORER_REQUIRED
 */
function classifyChange(change, section) {
  const { oldText, newText, position } = change;

  // Teardown changes never need Explorer (don't affect scenario state)
  if (isTeardownSection(section.sectionType)) {
    return { ...change, walkMode: 'DEEP', classification: 'BUILDER_ONLY' };
  }

  // Check if ONLY the expected value in a VERIFY/VERIFY_SOFT changed
  if (isVerifyValueOnlyChange(oldText, newText)) {
    return { ...change, walkMode: 'FAST', classification: 'BUILDER_ONLY' };
  }

  // Check if ONLY the CAPTURE variable name changed
  if (isCaptureNameOnlyChange(oldText, newText)) {
    return { ...change, walkMode: 'FAST', classification: 'BUILDER_ONLY' };
  }

  // Check if ONLY text content changed but same keyword + same target element
  if (isTextOnlyChange(oldText, newText)) {
    return { ...change, walkMode: 'FAST', classification: 'BUILDER_ONLY' };
  }

  // Default: interaction changed → Explorer must verify
  return { ...change, walkMode: 'DEEP', classification: 'EXPLORER_REQUIRED' };
}

/**
 * Check if only the expected value in VERIFY changed.
 * e.g., 'VERIFY total displays "$50.00"' → 'VERIFY total displays "$75.00"'
 * The element (total) is the same, only the expected value changed.
 */
function isVerifyValueOnlyChange(oldText, newText) {
  const verifyPattern = /^(VERIFY(?:_SOFT)?)\s+(.+?)\s+(?:displays?|shows?|contains?|equals?|is|has|reads?)\s+["'](.+?)["']$/i;
  const oldMatch = oldText.match(verifyPattern);
  const newMatch = newText.match(verifyPattern);

  if (oldMatch && newMatch) {
    // Same keyword and same target, different value
    if (normalizeStep(oldMatch[1]) === normalizeStep(newMatch[1]) &&
        normalizeStep(oldMatch[2]) === normalizeStep(newMatch[2])) {
      return true;
    }
  }

  // Simpler pattern: both start with VERIFY and share the same element reference
  const simpleVerify = /^(VERIFY(?:_SOFT)?)\s+(.+?)\s+(displays?|shows?|contains?|equals?|is|has|reads?)\s+/i;
  const oldSimple = oldText.match(simpleVerify);
  const newSimple = newText.match(simpleVerify);

  if (oldSimple && newSimple) {
    if (normalizeStep(oldSimple[2]) === normalizeStep(newSimple[2])) {
      return true;
    }
  }

  return false;
}

/**
 * Check if only the CAPTURE variable name changed.
 * e.g., 'CAPTURE order total as {{orderTotal}}' → 'CAPTURE order total as {{finalTotal}}'
 */
function isCaptureNameOnlyChange(oldText, newText) {
  const capturePattern = /^(CAPTURE)\s+(.+?)\s+as\s+\{\{(.+?)\}\}$/i;
  const oldMatch = oldText.match(capturePattern);
  const newMatch = newText.match(capturePattern);

  if (oldMatch && newMatch) {
    // Same element, different variable name
    if (normalizeStep(oldMatch[2]) === normalizeStep(newMatch[2])) {
      return true;
    }
  }
  return false;
}

/**
 * Check if the change is text-only (same keyword, same target element, different descriptive text).
 * e.g., 'Click "Submit" button' → 'Click "Submit Order" button' — different element, EXPLORER_REQUIRED
 * e.g., 'VERIFY page title shows "Cart"' → 'VERIFY page title shows "Shopping Cart"' — same element
 *
 * Conservative: if we can't definitively determine it's text-only, return false (EXPLORER_REQUIRED).
 */
function isTextOnlyChange(oldText, newText) {
  // Extract quoted strings (element identifiers)
  const quotedPattern = /["']([^"']+)["']/g;
  const oldQuoted = [...oldText.matchAll(quotedPattern)].map(m => m[1]);
  const newQuoted = [...newText.matchAll(quotedPattern)].map(m => m[1]);

  // If the step has no quoted strings, we can't determine — be conservative
  if (oldQuoted.length === 0 && newQuoted.length === 0) return false;

  // Extract the action verb (first word)
  const oldVerb = oldText.split(/\s+/)[0].toLowerCase();
  const newVerb = newText.split(/\s+/)[0].toLowerCase();

  // If the action verb changed (e.g., Click → Select), it's a different interaction
  if (oldVerb !== newVerb) return false;

  // SCREENSHOT/REPORT keyword text changes are always BUILDER_ONLY
  if (['screenshot', 'report'].includes(oldVerb)) return true;

  return false;
}

/**
 * Check if a section is a teardown section.
 */
function isTeardownSection(sectionType) {
  return sectionType === 'commonTeardown' || sectionType === 'commonTeardownOnce';
}

/**
 * Determine overall pipeline mode from section results.
 */
function determinePipelineMode(sections) {
  let hasAnyChanges = false;
  let hasExplorerRequired = false;

  for (const section of sections) {
    if (section.modified.length > 0 || section.added.length > 0 || section.deleted.length > 0) {
      hasAnyChanges = true;
    }
    if (section.modified.some(m => m.classification === 'EXPLORER_REQUIRED') ||
        section.added.some(a => a.classification === 'EXPLORER_REQUIRED')) {
      hasExplorerRequired = true;
    }
  }

  if (!hasAnyChanges) return 'NO_CHANGES';
  if (hasExplorerRequired) return 'EXPLORER_REQUIRED';
  return 'BUILDER_ONLY';
}

/**
 * Build human-readable summary.
 */
function buildSummary(sections, pipelineMode) {
  const counts = { unchanged: 0, modified: 0, added: 0, deleted: 0 };
  const affectedSections = [];

  for (const s of sections) {
    counts.unchanged += s.unchanged.length;
    counts.modified += s.modified.length;
    counts.added += s.added.length;
    counts.deleted += s.deleted.length;
    if (s.modified.length > 0 || s.added.length > 0 || s.deleted.length > 0) {
      affectedSections.push(s.name);
    }
  }

  const parts = [];
  if (counts.unchanged > 0) parts.push(`${counts.unchanged} unchanged`);
  if (counts.modified > 0) parts.push(`${counts.modified} modified`);
  if (counts.added > 0) parts.push(`${counts.added} added`);
  if (counts.deleted > 0) parts.push(`${counts.deleted} deleted`);

  const affected = affectedSections.length > 0
    ? ` | Affected: ${affectedSections.join(', ')}`
    : '';

  return `${pipelineMode}: ${parts.join(', ')}${affected}`;
}

/**
 * Build the final changeset object.
 */
function buildChangeset({ scenarioFile, specFile, pipelineMode, sections, summary }) {
  return {
    scenarioFile,
    specFile,
    pipelineMode,
    sections,
    affectedScenarios: sections
      .filter(s => s.type === 'scenario' && (s.modified.length > 0 || s.added.length > 0 || s.deleted.length > 0))
      .map(s => s.name),
    totalSteps: {
      unchanged: sections.reduce((sum, s) => sum + s.unchanged.length, 0),
      modified: sections.reduce((sum, s) => sum + s.modified.length, 0),
      added: sections.reduce((sum, s) => sum + s.added.length, 0),
      deleted: sections.reduce((sum, s) => sum + s.deleted.length, 0),
    },
    summary,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Write output to file and stdout.
 */
function writeOutput(changeset) {
  const outputFile = args.output || path.join(ROOT, 'output', 'reports', 'classified-changeset.json');
  const outputDir = path.dirname(outputFile);
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(outputFile, JSON.stringify(changeset, null, 2));

  console.log(`\nPipeline Mode: ${changeset.pipelineMode}`);
  console.log(`Summary: ${changeset.summary}`);
  if (changeset.affectedScenarios.length > 0) {
    console.log(`Affected scenarios: ${changeset.affectedScenarios.join(', ')}`);
  }
  console.log(`Output: ${outputFile}`);
}
