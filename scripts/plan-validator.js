#!/usr/bin/env node
/**
 * plan-validator.js — Validate an execution plan before replay.
 *
 * Checks:
 *   1. JSON schema conformance
 *   2. Required ENV variables are set in output/.env
 *   3. Referenced data source files exist and are parseable
 *   4. Referenced skills exist
 *   5. Variable references are resolvable (except captured variables)
 *   6. Source scenario hash matches (detect stale plans)
 *
 * Usage:
 *   node scripts/plan-validator.js --plan=output/plans/web/scenario.plan.json
 *
 * Exit codes:
 *   0 = valid
 *   1 = validation errors found
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// --- Argument parsing ---
const args = Object.fromEntries(
  process.argv.slice(2).map(a => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v];
  })
);

if (!args.plan) {
  console.error('Usage: node scripts/plan-validator.js --plan=<path>');
  process.exit(1);
}

const planPath = path.resolve(args.plan);

// --- Validation ---

const errors = [];
const warnings = [];

// 1. Load plan
let plan;
try {
  const raw = fs.readFileSync(planPath, 'utf-8');
  plan = JSON.parse(raw);
} catch (e) {
  console.error(`FATAL: Cannot read/parse plan: ${e.message}`);
  process.exit(1);
}

// 2. Schema version
if (plan.schema !== 'agentic-qe/execution-plan/1.0') {
  errors.push(`Unknown schema version: ${plan.schema} (expected agentic-qe/execution-plan/1.0)`);
}

// 3. Required top-level fields
const requiredFields = ['scenario', 'generatedAt', 'generatedBy', 'planHash', 'environment', 'steps'];
for (const field of requiredFields) {
  if (!plan[field]) {
    errors.push(`Missing required field: ${field}`);
  }
}

// 4. Scenario fields
if (plan.scenario) {
  const scenarioFields = ['name', 'source', 'sourceHash', 'type', 'tags'];
  for (const field of scenarioFields) {
    if (!plan.scenario[field]) {
      errors.push(`Missing scenario.${field}`);
    }
  }
  const validTypes = ['web', 'api', 'hybrid', 'mobile', 'mobile-hybrid'];
  if (plan.scenario.type && !validTypes.includes(plan.scenario.type)) {
    errors.push(`Invalid scenario type: ${plan.scenario.type} (expected one of: ${validTypes.join(', ')})`);
  }
}

// 5. Check source scenario hash (detect stale plans)
if (plan.scenario && plan.scenario.source && plan.scenario.sourceHash) {
  const sourcePath = path.resolve(plan.scenario.source);
  if (fs.existsSync(sourcePath)) {
    const sourceContent = fs.readFileSync(sourcePath, 'utf-8');
    const currentHash = 'sha256:' + crypto.createHash('sha256').update(sourceContent).digest('hex');
    if (currentHash !== plan.scenario.sourceHash) {
      warnings.push(`Source scenario has changed since plan was generated. Plan may be stale.`);
      warnings.push(`  Plan hash:    ${plan.scenario.sourceHash.substring(0, 20)}...`);
      warnings.push(`  Current hash: ${currentHash.substring(0, 20)}...`);
    }
  } else {
    warnings.push(`Source scenario file not found: ${sourcePath}`);
  }
}

// 6. Check ENV variables
if (plan.environment && plan.environment.variables) {
  const dotenv = require('dotenv');
  const envPath = path.resolve('output', '.env');
  const envResult = dotenv.config({ path: envPath });
  const envVars = { ...process.env, ...(envResult.parsed || {}) };

  for (const varName of plan.environment.variables) {
    if (!envVars[varName]) {
      errors.push(`Missing ENV variable: ${varName} (required by plan, not found in output/.env or process.env)`);
    }
  }
}

// 7. Check data sources
if (plan.dataSources) {
  for (const [name, source] of Object.entries(plan.dataSources)) {
    const filePath = path.resolve(source.file);
    if (!fs.existsSync(filePath)) {
      errors.push(`Data source "${name}" file not found: ${filePath}`);
    } else {
      // Try to parse
      try {
        if (source.format === 'json') {
          JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        } else if (source.format === 'csv') {
          const content = fs.readFileSync(filePath, 'utf-8');
          if (content.trim().split('\n').length < 2) {
            warnings.push(`Data source "${name}" CSV has no data rows`);
          }
        } else if (source.format === 'excel') {
          warnings.push(`Data source "${name}" is Excel — install exceljs to validate`);
        }
      } catch (e) {
        errors.push(`Data source "${name}" parse error: ${e.message}`);
      }
    }
  }
}

// 8. Check steps
if (plan.steps) {
  const validTypes = [
    'NAVIGATE', 'ACTION', 'VERIFY', 'VERIFY_SOFT',
    'CAPTURE', 'CALCULATE', 'SCREENSHOT', 'REPORT',
    'API_CALL', 'DB_QUERY', 'WRITE_DATA', 'SKILL',
    'WAIT', 'FOR_EACH', 'CONDITIONAL',
  ];

  const seenIds = new Set();
  for (const step of plan.steps) {
    // Step ID uniqueness
    if (seenIds.has(step.id)) {
      errors.push(`Duplicate step ID: ${step.id}`);
    }
    seenIds.add(step.id);

    // Step type validation
    if (!validTypes.includes(step.type)) {
      errors.push(`Step ${step.id}: Unknown type "${step.type}"`);
    }

    // Required step fields
    if (!step.description) {
      errors.push(`Step ${step.id}: Missing description`);
    }
    if (!step.action) {
      errors.push(`Step ${step.id}: Missing action`);
    }

    // Check SKILL references
    if (step.type === 'SKILL' && step.action && step.action.skill) {
      const skillName = step.action.skill.split('/')[0];
      const skillPath = path.resolve('skills', 'replay', `${skillName}.skill.ts`);
      const skillPathJs = path.resolve('skills', 'replay', `${skillName}.skill.js`);
      if (!fs.existsSync(skillPath) && !fs.existsSync(skillPathJs)) {
        warnings.push(`Step ${step.id}: Skill "${step.action.skill}" not found at ${skillPath}`);
      }
    }
  }

  // Check step ID continuity
  const ids = plan.steps.map(s => s.id).sort((a, b) => a - b);
  for (let i = 0; i < ids.length - 1; i++) {
    if (ids[i + 1] - ids[i] > 1) {
      warnings.push(`Gap in step IDs: ${ids[i]} → ${ids[i + 1]}`);
    }
  }
}

// 9. Collect variable references and check resolvability
const allVarRefs = new Set();
const json = JSON.stringify(plan.steps || []);
const varRegex = /\{\{([^}]+)\}\}/g;
let match;
while ((match = varRegex.exec(json)) !== null) {
  allVarRefs.add(match[1].trim());
}

// Variables that are resolved at runtime (cannot validate at dry-run)
const runtimeNamespaces = ['_runtime', '_downloads'];
const captureTargets = new Set();
for (const step of (plan.steps || [])) {
  if (step.action && step.action.captureAs) {
    captureTargets.add(step.action.captureAs);
  }
}

for (const ref of allVarRefs) {
  const namespace = ref.split('.')[0];
  // Skip runtime and captured variables — they're resolved during execution
  if (runtimeNamespaces.includes(namespace)) continue;
  if (captureTargets.has(ref)) continue;
  if (captureTargets.has(namespace)) continue;

  // Check ENV refs
  if (namespace === 'ENV') {
    const varName = ref.split('.')[1];
    if (plan.environment && !plan.environment.variables.includes(varName)) {
      warnings.push(`Variable {{${ref}}} references ENV.${varName} but it's not in environment.variables list`);
    }
  }
}

// --- Output ---

console.log(`\n  Plan Validator v1.0`);
console.log(`  Plan: ${planPath}`);
console.log(`  Scenario: ${plan.scenario?.name || 'unknown'}`);
console.log(`  Steps: ${plan.steps?.length || 0}`);
console.log(`  Type: ${plan.scenario?.type || 'unknown'}`);
console.log('');

if (errors.length === 0 && warnings.length === 0) {
  console.log('  VALID: Plan passed all checks.\n');
  process.exit(0);
}

if (warnings.length > 0) {
  console.log(`  WARNINGS (${warnings.length}):`);
  for (const w of warnings) {
    console.log(`    ⚠ ${w}`);
  }
  console.log('');
}

if (errors.length > 0) {
  console.log(`  ERRORS (${errors.length}):`);
  for (const e of errors) {
    console.log(`    ✗ ${e}`);
  }
  console.log('');
  console.log('  INVALID: Plan has errors. Fix before replay.\n');
  process.exit(1);
}

console.log('  VALID (with warnings): Plan can be replayed.\n');
process.exit(0);
