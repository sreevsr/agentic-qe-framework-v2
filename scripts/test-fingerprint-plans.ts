/**
 * test-fingerprint-plans.ts — Run actual plan.json files through the replay engine
 * AND fingerprint scanner side-by-side.
 *
 * For each ACTION/VERIFY step:
 *   1. Scan the page (fingerprint all elements)
 *   2. Execute the step normally via replay engine (existing resolver)
 *   3. After step passes, check: could the fingerprint resolver have found
 *      the same element independently?
 *
 * This proves the scanner+resolver work on REAL flows, not just static pages.
 *
 * Usage:
 *   npx tsx scripts/test-fingerprint-plans.ts --plan=output/plans/web/automationexercise-trial.plan.json --headed
 *   npx tsx scripts/test-fingerprint-plans.ts --plan=all --headed
 */

import { chromium, Browser, BrowserContext, Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import { scanPage, ElementFingerprint } from './replay/page-scanner';
import { resolveByFingerprint } from './replay/fingerprint-resolver';
import { buildContext, resolveDeep, VariableContext } from './replay/variable-resolver';
import { handlers, Step, ReplayConfig } from './replay/step-handlers';
import { getPopupSuppressingContextOptions } from './replay/popup-dismisser';

// --- CLI ---

interface CliArgs {
  plan: string;   // path or "all"
  headed: boolean;
}

function parseArgs(): CliArgs {
  const args: Record<string, string | boolean> = {};
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith('--')) {
      const [key, ...rest] = arg.slice(2).split('=');
      args[key] = rest.length > 0 ? rest.join('=') : true;
    }
  }
  return {
    plan: (args.plan as string) || 'all',
    headed: !!args.headed,
  };
}

const ALL_PLANS = [
  'output/plans/web/automationexercise-trial.plan.json',
  'output/plans/web/orangehrm-claims.plan.json',
  'output/plans/web/orangehrm-dashboard-charts.plan.json',
  'output/plans/web/orangehrm-myinfo-update.plan.json',
];

// --- Types ---

interface StepFingerprintResult {
  stepId: number;
  description: string;
  type: string;
  replayResult: 'pass' | 'fail' | 'skip';
  scanElements: number;
  scanMs: number;
  fingerprintMatch: boolean;
  fingerprintTier: number | null;
  fingerprintConfidence: number;
  fingerprintStrategy: string;
  fingerprintMs: number;
}

interface PlanResult {
  planName: string;
  totalSteps: number;
  replayPassed: number;
  replayFailed: number;
  fingerprintTested: number;
  fingerprintMatched: number;
  fingerprintTier1: number;
  fingerprintTier2: number;
  fingerprintFailed: number;
  steps: StepFingerprintResult[];
  totalDurationMs: number;
}

// --- Main Test Runner ---

async function runPlanTest(
  planPath: string,
  browser: Browser,
): Promise<PlanResult> {
  // Load plan
  const fullPath = path.resolve(planPath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Plan not found: ${fullPath}`);
  }
  const plan = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
  const planName = plan.scenario.name;

  console.log(`\n${'='.repeat(70)}`);
  console.log(`PLAN: ${planName} (${plan.steps.length} steps)`);
  console.log(`${'='.repeat(70)}`);

  // Build variable context
  const envPath = path.resolve('output/.env');
  const variables = buildContext(
    fs.existsSync(envPath) ? envPath : undefined,
    plan.dataSources || {},
  );

  // Launch context + page
  const context = await browser.newContext({
    ...getPopupSuppressingContextOptions(),
    viewport: { width: 1280, height: 720 },
  });
  const page = await context.newPage();

  const config: ReplayConfig = {
    timeouts: { action: 10000, navigation: 30000, test: 120000 },
    screenshotOnFailure: false,
    pacing: { globalDelayMs: 0, postNavWait: String(plan.pacing?.postNavWaitMs || 0) },
  };

  const screenshotDir = path.resolve('output/test-results/fingerprint-test');
  fs.mkdirSync(screenshotDir, { recursive: true });

  const handlerCtx = { page, variables, config, screenshotDir };
  const stepResults: StepFingerprintResult[] = [];
  const planStart = Date.now();

  for (const rawStep of plan.steps) {
    const step: Step = resolveDeep(rawStep, variables);
    const hasTarget = stepHasTarget(step);

    console.log(`  [${step.id}] ${step.type}: ${step.description}`);

    // --- Scan BEFORE step (to capture current page state) ---
    let scanElements = 0;
    let scanMs = 0;
    let fingerprintMatch = false;
    let fingerprintTier: number | null = null;
    let fingerprintConfidence = 0;
    let fingerprintStrategy = 'n/a';
    let fingerprintMs = 0;

    if (hasTarget) {
      const scanStart = Date.now();
      try {
        const scan = await scanPage(page);
        scanElements = scan.elements.length;
        scanMs = Date.now() - scanStart;
      } catch (err: any) {
        scanMs = Date.now() - scanStart;
        console.log(`       Scan failed: ${err.message.substring(0, 80)}`);
      }
    }

    // --- Execute step via replay engine ---
    const handler = handlers[step.type];
    let replayResult: 'pass' | 'fail' | 'skip' = 'skip';

    if (handler) {
      try {
        const result = await handler(step, handlerCtx);
        replayResult = result.status;
        if (result.status === 'pass') {
          console.log(`       Replay: PASS (${result.evidence?.substring(0, 60)})`);
        } else {
          console.log(`       Replay: ${result.status.toUpperCase()} — ${result.error?.substring(0, 80)}`);
        }
      } catch (err: any) {
        replayResult = 'fail';
        console.log(`       Replay: FAIL — ${err.message.substring(0, 80)}`);
      }
    }

    // --- After step passes, test fingerprint resolution ---
    // Only test fingerprint on steps that have a target AND replay passed
    if (hasTarget && replayResult === 'pass') {
      const target = extractTarget(step);
      if (target) {
        const fpStart = Date.now();
        try {
          // Scan the page BEFORE the action resolved target disappears
          const postScan = await scanPage(page);

          // Strategy 1: Use the actual Playwright locator to find the element,
          // then match it to a scanned fingerprint by position overlap.
          // This is more reliable than text/role heuristics.
          const matchingFp = await findFingerprintByLocator(page, target, postScan.elements)
            || findBestFingerprintForTarget(postScan.elements, target, step);

          if (matchingFp) {
            const match = await resolveByFingerprint(page, matchingFp, 5000);
            fingerprintMs = Date.now() - fpStart;

            if (match) {
              fingerprintMatch = true;
              fingerprintTier = match.tier;
              fingerprintConfidence = match.confidence;
              fingerprintStrategy = match.strategy;
              console.log(`       Fingerprint: MATCH tier${match.tier} (${match.confidence}pts) ${match.strategy.substring(0, 50)}`);
            } else {
              fingerprintMs = Date.now() - fpStart;
              console.log(`       Fingerprint: NO MATCH`);
            }
          } else {
            fingerprintMs = Date.now() - fpStart;
            fingerprintStrategy = 'no-matching-element-in-scan';
            console.log(`       Fingerprint: target not found in scan (${postScan.elements.length} elements)`);
          }
        } catch (err: any) {
          fingerprintMs = Date.now() - fpStart;
          fingerprintStrategy = `error: ${err.message.substring(0, 50)}`;
          console.log(`       Fingerprint: ERROR — ${err.message.substring(0, 80)}`);
        }
      }
    }

    stepResults.push({
      stepId: step.id,
      description: step.description,
      type: step.type,
      replayResult,
      scanElements,
      scanMs,
      fingerprintMatch,
      fingerprintTier,
      fingerprintConfidence,
      fingerprintStrategy,
      fingerprintMs,
    });

    // Stop on hard failure
    if (replayResult === 'fail' && step.onFailure !== 'continue') {
      // Check if this is a soft verify
      if (step.type !== 'VERIFY_SOFT') {
        console.log(`       STOPPING — step failed with onFailure=${step.onFailure || 'stop'}`);
        break;
      }
    }
  }

  await context.close();

  const totalDuration = Date.now() - planStart;
  const tested = stepResults.filter((s) => s.fingerprintStrategy !== 'n/a');

  return {
    planName,
    totalSteps: stepResults.length,
    replayPassed: stepResults.filter((s) => s.replayResult === 'pass').length,
    replayFailed: stepResults.filter((s) => s.replayResult === 'fail').length,
    fingerprintTested: tested.length,
    fingerprintMatched: tested.filter((s) => s.fingerprintMatch).length,
    fingerprintTier1: tested.filter((s) => s.fingerprintTier === 1).length,
    fingerprintTier2: tested.filter((s) => s.fingerprintTier === 2).length,
    fingerprintFailed: tested.filter((s) => !s.fingerprintMatch && s.fingerprintStrategy !== 'n/a').length,
    steps: stepResults,
    totalDurationMs: totalDuration,
  };
}

// --- Helpers ---

/** Check if a step has a target that needs element resolution. */
function stepHasTarget(step: Step): boolean {
  if (!step.action) return false;
  const a = step.action;
  if (a.target) return true;
  if (a.fields) return true; // fill_form
  if (a.scope) return true;  // scoped verify
  return false;
}

/** Extract the primary target from a step. */
function extractTarget(step: Step): any {
  const a = step.action;
  if (a.target) return a.target;
  if (a.fields && a.fields.length > 0) return a.fields[0].target;
  if (a.scope) return a.scope;
  return null;
}

/**
 * Find fingerprint by resolving the target with Playwright first (which we know works),
 * then matching the resolved element's bounding box to a scanned fingerprint.
 * This simulates what the plan generator would do: interact with an element,
 * then capture its fingerprint from the scan.
 */
async function findFingerprintByLocator(
  page: Page,
  target: any,
  elements: Array<{ fingerprint: ElementFingerprint }>,
): Promise<ElementFingerprint | null> {
  try {
    // Resolve via existing element-resolver (same as replay engine)
    const { resolveWithFallbacks } = await import('./replay/element-resolver');
    const { locator } = await resolveWithFallbacks(page, target, 3000);

    // Get bounding box of the resolved element
    const box = await locator.boundingBox({ timeout: 2000 });
    if (!box) return null;

    // Find the scanned fingerprint closest to this position
    let bestDist = Infinity;
    let bestFp: ElementFingerprint | null = null;

    for (const el of elements) {
      const fp = el.fingerprint;
      const dx = Math.abs(fp.rect.x - box.x);
      const dy = Math.abs(fp.rect.y - box.y);
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < bestDist && dist < 50) { // within 50px
        bestDist = dist;
        bestFp = fp;
      }
    }

    return bestFp;
  } catch {
    return null;
  }
}

/**
 * Find the scanned element that best matches the step's target description.
 * Uses text, role, name, placeholder overlap.
 */
function findBestFingerprintForTarget(
  elements: Array<{ fingerprint: ElementFingerprint }>,
  target: any,
  step: Step,
): ElementFingerprint | null {
  let bestScore = 0;
  let bestFp: ElementFingerprint | null = null;

  for (const el of elements) {
    const fp = el.fingerprint;
    let score = 0;

    // Match by text
    if (target.text && fp.text && fp.text.includes(target.text)) score += 30;
    if (target.nameContains && fp.text && fp.text.includes(target.nameContains)) score += 25;
    if (target.name && fp.ariaLabel && fp.ariaLabel.includes(target.name)) score += 25;
    if (target.name && fp.text && fp.text.includes(target.name)) score += 20;

    // Match by role→tag mapping
    if (target.role) {
      const roleTagMap: Record<string, string[]> = {
        button: ['button'], link: ['a'], textbox: ['input', 'textarea'],
        heading: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
        checkbox: ['input'], radio: ['input'], combobox: ['select', 'input'],
      };
      const expectedTags = roleTagMap[target.role] || [];
      if (expectedTags.includes(fp.tag)) score += 10;
      if (fp.role === target.role) score += 15;
    }

    // Match by placeholder
    if (target.placeholder && fp.placeholder && fp.placeholder.includes(target.placeholder)) score += 20;

    // Match by CSS
    if (target.css && fp.cssPath && fp.cssPath.includes(target.css)) score += 15;

    // Match by label
    if (target.label && fp.ariaLabel && fp.ariaLabel.includes(target.label)) score += 25;

    // Visibility bonus
    if (fp.visible) score += 5;

    if (score > bestScore) {
      bestScore = score;
      bestFp = fp;
    }
  }

  // Require minimum match quality
  return bestScore >= 15 ? bestFp : null;
}

// --- Report ---

function printFinalReport(results: PlanResult[]): void {
  console.log('\n' + '='.repeat(70));
  console.log('FINGERPRINT PLAN TEST — FINAL REPORT');
  console.log('='.repeat(70));

  let grandTotalTested = 0;
  let grandTotalMatched = 0;
  let grandTotalT1 = 0;
  let grandTotalT2 = 0;
  let grandTotalFailed = 0;

  for (const r of results) {
    const fpRate = r.fingerprintTested > 0
      ? ((r.fingerprintMatched / r.fingerprintTested) * 100).toFixed(1)
      : 'n/a';

    console.log(`\n  ${r.planName}`);
    console.log(`    Steps: ${r.totalSteps} | Replay: ${r.replayPassed} pass, ${r.replayFailed} fail`);
    console.log(`    Fingerprint tested: ${r.fingerprintTested} | Matched: ${r.fingerprintMatched} (${fpRate}%)`);
    console.log(`    Tier1: ${r.fingerprintTier1} | Tier2: ${r.fingerprintTier2} | Failed: ${r.fingerprintFailed}`);
    console.log(`    Duration: ${(r.totalDurationMs / 1000).toFixed(1)}s`);

    // Show failures
    const failures = r.steps.filter((s) => !s.fingerprintMatch && s.fingerprintStrategy !== 'n/a');
    if (failures.length > 0) {
      console.log(`    FINGERPRINT FAILURES:`);
      for (const f of failures) {
        console.log(`      [${f.stepId}] ${f.description} — ${f.fingerprintStrategy}`);
      }
    }

    grandTotalTested += r.fingerprintTested;
    grandTotalMatched += r.fingerprintMatched;
    grandTotalT1 += r.fingerprintTier1;
    grandTotalT2 += r.fingerprintTier2;
    grandTotalFailed += r.fingerprintFailed;
  }

  console.log('\n' + '-'.repeat(70));
  console.log('GRAND TOTAL');
  console.log('-'.repeat(70));
  console.log(`  Plans: ${results.length}`);
  console.log(`  Fingerprint tested: ${grandTotalTested}`);
  console.log(`  Matched: ${grandTotalMatched} (${grandTotalTested > 0 ? ((grandTotalMatched / grandTotalTested) * 100).toFixed(1) : 0}%)`);
  console.log(`  Tier 1: ${grandTotalT1} | Tier 2: ${grandTotalT2} | Failed: ${grandTotalFailed}`);
  console.log('='.repeat(70));
}

// --- Main ---

async function main(): Promise<void> {
  const args = parseArgs();

  const plans = args.plan === 'all'
    ? ALL_PLANS
    : [args.plan];

  const browser = await chromium.launch({
    headless: !args.headed,
    args: args.headed ? ['--start-maximized'] : [],
  });

  const results: PlanResult[] = [];
  for (const planPath of plans) {
    try {
      const result = await runPlanTest(planPath, browser);
      results.push(result);
    } catch (err: any) {
      console.error(`\n  PLAN ERROR (${planPath}): ${err.message}`);
    }
  }

  printFinalReport(results);
  await browser.close();
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
