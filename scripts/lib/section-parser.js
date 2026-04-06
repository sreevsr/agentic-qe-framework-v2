#!/usr/bin/env node

/**
 * section-parser.js — Shared section extraction for multi-scenario .md files
 *
 * Parses scenario and enriched .md files into section-scoped structures.
 * Used by: scenario-diff.js, builder-incremental.js, cleanup-annotations.js
 *
 * Sections recognized:
 *   ## Common Setup Once      → lifecycle (beforeAll)
 *   ## Common Setup           → lifecycle (beforeEach)
 *   ### Scenario: <name>      → scenario
 *   ## Common Teardown        → lifecycle (afterEach)
 *   ## Common Teardown Once   → lifecycle (afterAll)
 *   ## Steps                  → single-scenario (no ### Scenario: blocks)
 */

'use strict';

// Section heading patterns
const SECTION_PATTERNS = {
  commonSetupOnce:    /^##\s+Common Setup Once\s*$/i,
  commonSetup:        /^##\s+Common Setup\s*$/i,
  steps:              /^##\s+Steps\s*$/i,
  commonTeardown:     /^##\s+Common Teardown\s*$/i,
  commonTeardownOnce: /^##\s+Common Teardown Once\s*$/i,
  scenario:           /^###\s+Scenario:\s*(.+)$/i,
};

// Maps section type to Playwright spec block
const SPEC_BLOCK_MAP = {
  commonSetupOnce:    'beforeAll',
  commonSetup:        'beforeEach',
  steps:              'test',
  scenario:           'test',
  commonTeardown:     'afterEach',
  commonTeardownOnce: 'afterAll',
};

// Step label prefixes used in spec files for lifecycle hooks
const STEP_LABEL_PREFIX = {
  commonSetupOnce:    '[Setup]',
  commonSetup:        '[Before Each]',
  commonTeardown:     '[After Each]',
  commonTeardownOnce: '[After All]',
};

/**
 * Parse a scenario/enriched .md file into sections with their steps.
 *
 * @param {string} content - File content
 * @returns {{ metadata: string, sections: Section[], isMultiScenario: boolean }}
 *
 * Section shape:
 *   { name, type, specBlock, stepLabelPrefix, startLine, endLine, steps[], rawLines[] }
 *
 * Step shape:
 *   { position, text, lineNumber, rawLine, continuationLines[], annotations[] }
 */
function parseSections(content) {
  const lines = content.split('\n');
  const sections = [];
  let currentSection = null;
  let metadataLines = [];
  let metadataEnded = false;
  let hasScenarioBlocks = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Detect section headers
    const sectionType = detectSectionType(trimmed);

    if (sectionType) {
      // Close previous section
      if (currentSection) {
        currentSection.endLine = i - 1;
        sections.push(currentSection);
      }
      metadataEnded = true;

      const scenarioMatch = trimmed.match(SECTION_PATTERNS.scenario);
      const name = scenarioMatch ? scenarioMatch[1].trim() : sectionType;

      if (sectionType === 'scenario') hasScenarioBlocks = true;

      currentSection = {
        name: sectionType === 'scenario' ? `Scenario: ${name}` : name,
        type: sectionType === 'scenario' ? 'scenario' : 'lifecycle',
        sectionType,
        specBlock: SPEC_BLOCK_MAP[sectionType],
        stepLabelPrefix: STEP_LABEL_PREFIX[sectionType] || null,
        startLine: i,
        endLine: null,
        steps: [],
        rawLines: [line],
      };
      continue;
    }

    // Detect end of sections — a new ## heading that isn't a recognized section
    if (currentSection && /^##\s+/.test(trimmed) && !detectSectionType(trimmed)) {
      // Page section headers (### PageName) inside a section are kept
      if (/^###\s+/.test(trimmed) && !SECTION_PATTERNS.scenario.test(trimmed)) {
        currentSection.rawLines.push(line);
        continue;
      }
      // New ## section we don't recognize — end current section
      currentSection.endLine = i - 1;
      sections.push(currentSection);
      currentSection = null;
      if (!metadataEnded) metadataEnded = true;
      metadataLines.push(line);
      continue;
    }

    // Collect metadata (everything before first section)
    if (!currentSection && !metadataEnded) {
      metadataLines.push(line);
      continue;
    }

    // Inside a section — collect lines and extract steps
    if (currentSection) {
      currentSection.rawLines.push(line);

      // Detect numbered steps
      const stepMatch = trimmed.match(/^(\d+)\.\s+(.+)$/);
      if (stepMatch) {
        // Strip inline HTML comments (e.g., <!-- ORIGINAL -->) and strikethrough markers from step text
        const rawStepText = stepMatch[2].trim();
        const cleanStepText = rawStepText
          .replace(/<!--.*?-->/g, '')  // strip inline comments
          .replace(/^~~/g, '')         // strip strikethrough open
          .replace(/~~$/g, '')         // strip strikethrough close
          .trim();
        const step = {
          position: currentSection.steps.length + 1,
          globalStepNumber: parseInt(stepMatch[1], 10),
          text: cleanStepText,
          lineNumber: i,
          rawLine: line,
          continuationLines: [],
          annotations: [],
        };

        // Look ahead for continuation lines (annotations, indented text)
        for (let j = i + 1; j < lines.length; j++) {
          const nextLine = lines[j];
          const nextTrimmed = nextLine.trim();
          // Continuation: indented lines, <!-- annotations -->, empty lines between annotations
          if (nextTrimmed.startsWith('<!--') ||
              nextLine.startsWith('   ') ||
              nextLine.startsWith('\t') ||
              (nextTrimmed === '' && j + 1 < lines.length && lines[j + 1].trim().startsWith('<!--'))) {
            step.continuationLines.push(nextLine);
            // Extract annotation content
            const annoMatch = nextTrimmed.match(/^<!--\s*(.+?)\s*-->$/);
            if (annoMatch) step.annotations.push(annoMatch[1]);
          } else {
            break;
          }
        }

        currentSection.steps.push(step);
      }
    }
  }

  // Close last section
  if (currentSection) {
    currentSection.endLine = lines.length - 1;
    sections.push(currentSection);
  }

  return {
    metadata: metadataLines.join('\n'),
    sections,
    isMultiScenario: hasScenarioBlocks,
    totalSteps: sections.reduce((sum, s) => sum + s.steps.length, 0),
  };
}

/**
 * Detect section type from a trimmed line.
 * @returns {string|null} Section type key or null
 */
function detectSectionType(trimmed) {
  if (SECTION_PATTERNS.commonSetupOnce.test(trimmed)) return 'commonSetupOnce';
  if (SECTION_PATTERNS.commonSetup.test(trimmed)) return 'commonSetup';
  if (SECTION_PATTERNS.commonTeardown.test(trimmed)) return 'commonTeardown';
  if (SECTION_PATTERNS.commonTeardownOnce.test(trimmed)) return 'commonTeardownOnce';
  if (SECTION_PATTERNS.scenario.test(trimmed)) return 'scenario';
  if (SECTION_PATTERNS.steps.test(trimmed)) return 'steps';
  return null;
}

/**
 * Extract step descriptions from a spec file, grouped by block.
 *
 * Recognizes:
 *   test.step('Step N — description', ...)        → scenario steps
 *   test.step('[Setup] description', ...)          → lifecycle steps
 *   test.step('[Before Each] description', ...)    → lifecycle steps
 *   test('Scenario Name', ...)                     → scenario block boundary
 *   test.beforeAll(...)                             → lifecycle block boundary
 *
 * @param {string} specContent
 * @returns {{ blocks: SpecBlock[] }}
 *
 * SpecBlock shape:
 *   { name, type, steps: string[] }
 */
function parseSpecBlocks(specContent) {
  const blocks = [];
  let currentBlock = null;

  for (const line of specContent.split('\n')) {
    const trimmed = line.trim();

    // Detect block boundaries
    const beforeAllMatch = trimmed.match(/test\.beforeAll/);
    const beforeEachMatch = trimmed.match(/test\.beforeEach/);
    const afterEachMatch = trimmed.match(/test\.afterEach/);
    const afterAllMatch = trimmed.match(/test\.afterAll/);
    const testMatch = trimmed.match(/test\(\s*['"](.+?)['"]/);

    if (beforeAllMatch) {
      if (currentBlock) blocks.push(currentBlock);
      currentBlock = { name: 'commonSetupOnce', type: 'lifecycle', specBlock: 'beforeAll', steps: [] };
      continue;
    }
    if (beforeEachMatch) {
      if (currentBlock) blocks.push(currentBlock);
      currentBlock = { name: 'commonSetup', type: 'lifecycle', specBlock: 'beforeEach', steps: [] };
      continue;
    }
    if (afterEachMatch) {
      if (currentBlock) blocks.push(currentBlock);
      currentBlock = { name: 'commonTeardown', type: 'lifecycle', specBlock: 'afterEach', steps: [] };
      continue;
    }
    if (afterAllMatch) {
      if (currentBlock) blocks.push(currentBlock);
      currentBlock = { name: 'commonTeardownOnce', type: 'lifecycle', specBlock: 'afterAll', steps: [] };
      continue;
    }
    if (testMatch) {
      if (currentBlock) blocks.push(currentBlock);
      currentBlock = { name: `Scenario: ${testMatch[1]}`, type: 'scenario', specBlock: 'test', steps: [] };
      continue;
    }

    // Extract test.step labels
    // Must handle quoted strings inside the step label (e.g., 'Step 1 — Click on "Leave" in the side menu')
    // Strategy: find opening quote of test.step, then match to the CLOSING quote + comma/arrow pattern
    if (currentBlock) {
      const singleQuoteMatch = trimmed.match(/test\.step\(\s*'((?:Step\s+\d+\s*[—–-]\s*|(?:\[[\w\s]+\]\s*))(.+?))'\s*,/i);
      const doubleQuoteMatch = trimmed.match(/test\.step\(\s*"((?:Step\s+\d+\s*[—–-]\s*|(?:\[[\w\s]+\]\s*))(.+?))"\s*,/i);
      const stepMatch = singleQuoteMatch || doubleQuoteMatch;
      if (stepMatch) {
        // stepMatch[2] is the content after the prefix (Step N — or [Setup] )
        currentBlock.steps.push(stepMatch[2].trim());
      }
    }
  }

  if (currentBlock) blocks.push(currentBlock);
  return { blocks };
}

/**
 * Normalize step text for comparison — lowercase, strip punctuation, collapse whitespace.
 */
function normalizeStep(text) {
  return text.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
}

module.exports = {
  parseSections,
  parseSpecBlocks,
  normalizeStep,
  detectSectionType,
  SECTION_PATTERNS,
  SPEC_BLOCK_MAP,
  STEP_LABEL_PREFIX,
};
