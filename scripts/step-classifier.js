#!/usr/bin/env node
/**
 * step-classifier.js — Pre-classify scenario steps with ZERO LLM tokens
 *
 * Usage:
 *   node scripts/step-classifier.js --scenario=web/automationexercise-trial
 *
 * Output: JSON to stdout with classified steps ready for the Direct Execution Explorer.
 * Each step gets a type (ACTION, VERIFY, VERIFY_SOFT, CAPTURE, CALCULATE, SCREENSHOT, REPORT, NAVIGATE)
 * and extracted parameters (target element, value, variable name, etc.)
 */

const fs = require('fs');
const path = require('path');

// --- Argument parsing ---
const args = Object.fromEntries(
  process.argv.slice(2).map(a => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v];
  })
);

if (!args.scenario) {
  console.error('Usage: node scripts/step-classifier.js --scenario=web/automationexercise-trial');
  process.exit(1);
}

// --- Locate scenario file ---
const scenarioPath = path.join(process.cwd(), 'scenarios', `${args.scenario}.md`);
if (!fs.existsSync(scenarioPath)) {
  console.error(`Scenario not found: ${scenarioPath}`);
  process.exit(1);
}

const content = fs.readFileSync(scenarioPath, 'utf-8');

// --- Parse steps ---
// Steps are lines that start with a number followed by a period
const stepRegex = /^\s*(\d+)\.\s+(.+)$/;
const lines = content.split('\n');
const rawSteps = [];
let currentSection = '';

for (const line of lines) {
  // Track section headers
  const sectionMatch = line.match(/^###\s+(.+)/);
  if (sectionMatch) {
    currentSection = sectionMatch[1].trim();
    continue;
  }

  const stepMatch = line.match(stepRegex);
  if (stepMatch) {
    rawSteps.push({
      originalNumber: parseInt(stepMatch[1], 10),
      text: stepMatch[2].trim(),
      section: currentSection,
    });
  }
}

// Assign positional step numbers (1-based, sequential)
const steps = rawSteps.map((step, idx) => ({
  ...step,
  stepNumber: idx + 1,
}));

// --- Classify each step ---

function classifyStep(text) {
  const upper = text.toUpperCase();

  // Keyword-prefixed steps (highest priority)
  if (upper.startsWith('VERIFY_SOFT:')) return 'VERIFY_SOFT';
  if (upper.startsWith('VERIFY:'))      return 'VERIFY';
  if (upper.startsWith('CAPTURE:'))     return 'CAPTURE';
  if (upper.startsWith('CALCULATE:'))   return 'CALCULATE';
  if (upper.startsWith('SCREENSHOT:'))  return 'SCREENSHOT';
  if (upper.startsWith('REPORT:'))      return 'REPORT';

  // Navigation detection
  if (/^navigate\s+to\b/i.test(text))  return 'NAVIGATE';

  // Everything else is an ACTION (click, fill, enter, select, add, type, locate)
  return 'ACTION';
}

function extractParams(text, type) {
  const params = {};

  switch (type) {
    case 'VERIFY':
    case 'VERIFY_SOFT': {
      // Extract the assertion text after the keyword
      params.assertion = text.replace(/^VERIFY(?:_SOFT)?:\s*/i, '').trim();

      // Check if it references a captured variable
      const varRefs = params.assertion.match(/\{\{(\w+)\}\}/g);
      if (varRefs) {
        params.variableRefs = varRefs.map(v => v.replace(/[{}]/g, ''));
      }
      break;
    }

    case 'CAPTURE': {
      // CAPTURE: Read the price of "Blue Top" as {{blueTopPrice}}
      const captureMatch = text.match(/CAPTURE:\s*(.+?)\s+as\s+\{\{(\w+)\}\}/i);
      if (captureMatch) {
        params.description = captureMatch[1].trim();
        params.variableName = captureMatch[2];
      } else {
        // CAPTURE: Read the total price displayed as {{totalPrice}}
        const simpleMatch = text.match(/CAPTURE:\s*(.+?)\s+as\s+\{\{(\w+)\}\}/i)
          || text.match(/CAPTURE:\s*(.+)\{\{(\w+)\}\}/i);
        if (simpleMatch) {
          params.description = simpleMatch[1].trim();
          params.variableName = simpleMatch[2];
        } else {
          params.description = text.replace(/^CAPTURE:\s*/i, '').trim();
          const varMatch = text.match(/\{\{(\w+)\}\}/);
          if (varMatch) params.variableName = varMatch[1];
        }
      }
      break;
    }

    case 'CALCULATE': {
      // CALCULATE: {{expectedTotal}} = {{blueTopPrice}} + {{menTshirtPrice}} + ...
      const calcMatch = text.match(/CALCULATE:\s*\{\{(\w+)\}\}\s*=\s*(.+)/i);
      if (calcMatch) {
        params.resultVariable = calcMatch[1];
        params.expression = calcMatch[2].trim();
        // Extract all referenced variables
        const refs = params.expression.match(/\{\{(\w+)\}\}/g);
        if (refs) {
          params.operands = refs.map(v => v.replace(/[{}]/g, ''));
        }
      }
      break;
    }

    case 'SCREENSHOT': {
      params.name = text.replace(/^SCREENSHOT:\s*/i, '').trim();
      break;
    }

    case 'REPORT': {
      params.description = text.replace(/^REPORT:\s*/i, '').trim();
      // Extract variable references
      const varRefs = text.match(/\{\{(\w+)\}\}/g);
      if (varRefs) {
        params.variableRefs = varRefs.map(v => v.replace(/[{}]/g, ''));
      }
      break;
    }

    case 'NAVIGATE': {
      // Navigate to {{ENV.BASE_URL}} or Navigate to the Products page
      const urlMatch = text.match(/navigate\s+to\s+(.+)/i);
      if (urlMatch) {
        params.target = urlMatch[1].trim();
        params.isEnvUrl = /\{\{ENV\.\w+\}\}/.test(params.target);
      }
      break;
    }

    case 'ACTION': {
      // Detect action verb
      const lower = text.toLowerCase();
      if (/^click\b/i.test(text))       params.verb = 'click';
      else if (/^enter\b/i.test(text))  params.verb = 'fill';
      else if (/^fill\b/i.test(text))   params.verb = 'fill';
      else if (/^select\b/i.test(text)) params.verb = 'select';
      else if (/^add\b/i.test(text))    params.verb = 'click'; // "Add to cart" = click
      else if (/^type\b/i.test(text))   params.verb = 'fill';
      else if (/^locate\b/i.test(text)) params.verb = 'locate'; // find element, no action
      else                               params.verb = 'interact';

      params.description = text;

      // Check if it references env variables
      const envRefs = text.match(/\{\{ENV\.(\w+)\}\}/g);
      if (envRefs) {
        params.envVars = envRefs.map(v => v.match(/ENV\.(\w+)/)[1]);
      }

      // Check if it references captured variables
      const capturedRefs = text.match(/\{\{(\w+)\}\}/g);
      if (capturedRefs) {
        params.variableRefs = capturedRefs
          .filter(v => !v.includes('ENV.'))
          .map(v => v.replace(/[{}]/g, ''));
      }
      break;
    }
  }

  return params;
}

// --- Determine if step needs a browser snapshot ---
function needsSnapshot(type, prevType) {
  // These never need a snapshot
  if (['CALCULATE', 'REPORT', 'SCREENSHOT'].includes(type)) return false;

  // VERIFY/CAPTURE always need a snapshot to read page state
  if (['VERIFY', 'VERIFY_SOFT', 'CAPTURE'].includes(type)) return true;

  // NAVIGATE needs a post-navigation snapshot
  if (type === 'NAVIGATE') return true; // post-nav snapshot

  // ACTION: need snapshot to find the target element
  return true;
}

// --- Build classified output ---
const classified = steps.map((step, idx) => {
  const type = classifyStep(step.text);
  const params = extractParams(step.text, type);
  const prevType = idx > 0 ? classifyStep(steps[idx - 1].text) : null;

  return {
    step: step.stepNumber,
    originalNumber: step.originalNumber,
    section: step.section,
    text: step.text,
    type,
    params,
    needsSnapshot: needsSnapshot(type, prevType),
    // Estimate: does this step need LLM reasoning?
    needsLLM: ['VERIFY', 'VERIFY_SOFT', 'CAPTURE'].includes(type),
  };
});

// --- Summary statistics ---
const summary = {
  totalSteps: classified.length,
  byType: {},
  snapshotsNeeded: classified.filter(s => s.needsSnapshot).length,
  llmCallsNeeded: classified.filter(s => s.needsLLM).length,
  actionSteps: classified.filter(s => s.type === 'ACTION').length,
  sections: [...new Set(classified.map(s => s.section).filter(Boolean))],
};

for (const step of classified) {
  summary.byType[step.type] = (summary.byType[step.type] || 0) + 1;
}

// --- Output ---
const output = {
  scenario: args.scenario,
  classifiedAt: new Date().toISOString(),
  summary,
  steps: classified,
};

if (args.output) {
  const outPath = path.resolve(args.output);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.log(`Written to ${outPath}`);
} else {
  console.log(JSON.stringify(output, null, 2));
}
