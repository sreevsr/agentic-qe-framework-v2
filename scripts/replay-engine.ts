/**
 * replay-engine.ts — Deterministic plan executor for the Agentic QE Framework.
 *
 * Reads a cached execution plan (JSON), drives Playwright directly (no LLM),
 * and produces a PASS/FAIL report.
 *
 * Usage:
 *   npx tsx scripts/replay-engine.ts --plan=output/plans/web/scenario.plan.json [options]
 *
 * Options:
 *   --plan=<path>         Path to execution plan JSON (required)
 *   --browser=<name>      Browser: chromium (default), firefox, webkit
 *   --headed              Run with visible browser (default: headless)
 *   --report=<path>       Report output path (default: output/reports/replay-report-{scenario}.md)
 *   --report-format=<fmt> Report format: markdown (default), junit
 *   --data=<path>         Override test data file (JSON)
 *   --dry-run             Validate plan without running (check schema, env, data files)
 *   --timeout=<ms>        Override default action timeout
 *   --pacing=<ms>         Global delay between steps (default: 0)
 *   --post-nav-wait=<ms>  Wait after page navigations (default: 0, use 'networkidle' for auto)
 */

import { chromium, firefox, webkit, Browser, BrowserContext, Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import { buildContext, resolveDeep, validateEnvVariables, VariableContext } from './replay/variable-resolver';
import { handlers, StepResult, Step, ReplayConfig } from './replay/step-handlers';
import { configureBrowserPopupHandling, getPopupSuppressingContextOptions } from './replay/popup-dismisser';
import { generateMarkdownReport, generateJUnitXml, saveReport, ReplayResults, StepReportEntry } from './replay/report-generator';

// --- Argument Parsing ---

interface CliArgs {
  plan: string;
  browser: 'chromium' | 'firefox' | 'webkit';
  headed: boolean;
  report?: string;
  reportFormat: 'markdown' | 'junit';
  data?: string;
  dryRun: boolean;
  timeout?: number;
  pacing: number;
  postNavWait: string; // ms number or 'networkidle'
}

function parseArgs(): CliArgs {
  const args: Record<string, string | boolean> = {};
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith('--')) {
      const [key, value] = arg.replace('--', '').split('=');
      args[key] = value ?? true;
    }
  }

  if (!args.plan) {
    console.error('Usage: npx tsx scripts/replay-engine.ts --plan=<path> [options]');
    console.error('\nOptions:');
    console.error('  --browser=chromium|firefox|webkit');
    console.error('  --headed              Run with visible browser');
    console.error('  --report=<path>       Report output path');
    console.error('  --report-format=markdown|junit');
    console.error('  --data=<path>         Override test data (JSON)');
    console.error('  --dry-run             Validate only, no browser');
    console.error('  --timeout=<ms>        Action timeout override');
    console.error('  --pacing=<ms>         Global delay between steps (default: 0)');
    console.error('  --post-nav-wait=<ms>  Wait after navigations (default: 0, or "networkidle")');
    process.exit(1);
  }

  return {
    plan: args.plan as string,
    browser: (args.browser as any) || 'chromium',
    headed: !!args.headed,
    report: args.report as string | undefined,
    reportFormat: (args['report-format'] as any) || 'markdown',
    data: args.data as string | undefined,
    dryRun: !!args['dry-run'],
    timeout: args.timeout ? Number(args.timeout) : undefined,
    pacing: args.pacing ? Number(args.pacing) : 0,
    postNavWait: (args['post-nav-wait'] as string) || '0',
  };
}

// --- Load Framework Config ---

function loadFrameworkConfig(args: CliArgs): ReplayConfig {
  const configPath = path.resolve('framework-config.json');
  let config: ReplayConfig = {
    timeouts: { action: 30000, navigation: 60000, test: 180000 },
    screenshotOnFailure: true,
    pacing: {
      globalDelayMs: args.pacing,
      postNavWait: args.postNavWait,
    },
  };

  if (fs.existsSync(configPath)) {
    try {
      const raw = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      config.timeouts = {
        action: raw.timeouts?.actionTimeoutMs || 30000,
        navigation: raw.timeouts?.navigationTimeoutMs || 60000,
        test: raw.timeouts?.testTimeoutMs || 180000,
      };
    } catch {
      console.warn('Warning: Could not parse framework-config.json, using defaults');
    }
  }

  return config;
}

// --- Load Data Sources ---

function loadDataSources(dataSources: Record<string, any>): Record<string, any> {
  const loaded: Record<string, any> = {};

  for (const [name, source] of Object.entries(dataSources)) {
    const filePath = path.resolve(source.file);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Data source "${name}" file not found: ${filePath}`);
    }

    switch (source.format) {
      case 'json':
        loaded[name] = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        break;
      case 'csv':
        loaded[name] = parseCsv(fs.readFileSync(filePath, 'utf-8'));
        break;
      case 'excel':
        throw new Error(`Excel data source "${name}" requires exceljs. Install: npm install exceljs`);
      default:
        throw new Error(`Unknown data source format: ${source.format}`);
    }
  }

  return loaded;
}

function parseCsv(content: string): Record<string, string>[] {
  const lines = content.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  return lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = values[i] || ''; });
    return row;
  });
}

// --- Main ---

async function main() {
  const args = parseArgs();
  const startTime = new Date();
  console.log(`\n  Replay Engine v1.0`);
  console.log(`  Plan: ${args.plan}`);
  console.log(`  Browser: ${args.browser}`);
  console.log(`  Mode: ${args.dryRun ? 'DRY RUN' : args.headed ? 'headed' : 'headless'}\n`);

  // 1. Load plan
  const planPath = path.resolve(args.plan);
  if (!fs.existsSync(planPath)) {
    console.error(`Plan file not found: ${planPath}`);
    process.exit(1);
  }
  const plan = JSON.parse(fs.readFileSync(planPath, 'utf-8'));
  console.log(`  Scenario: ${plan.scenario.name}`);
  console.log(`  Steps: ${plan.steps.length}`);
  console.log(`  Type: ${plan.scenario.type}`);
  console.log(`  Generated: ${plan.generatedAt}\n`);

  // 2. Build variable context
  const envPath = path.resolve('output', '.env');
  const testDataOverride = args.data
    ? JSON.parse(fs.readFileSync(path.resolve(args.data), 'utf-8'))
    : {};

  let dataSources: Record<string, any> = {};
  if (plan.dataSources && Object.keys(plan.dataSources).length > 0) {
    dataSources = loadDataSources(plan.dataSources);
  }

  const context = buildContext(envPath, testDataOverride, dataSources);

  // 3. Pre-flight validation
  console.log('  Pre-flight checks:');

  // Check env variables
  const missingEnv = validateEnvVariables(plan.environment.variables, context);
  if (missingEnv.length > 0) {
    console.error(`  FAIL: Missing environment variables: ${missingEnv.join(', ')}`);
    process.exit(1);
  }
  console.log(`    ENV variables: OK (${plan.environment.variables.length} required, all present)`);

  // Check data sources
  console.log(`    Data sources: OK (${Object.keys(plan.dataSources || {}).length} loaded)`);

  // Schema version check
  if (plan.schema !== 'agentic-qe/execution-plan/1.0') {
    console.error(`  FAIL: Unknown plan schema: ${plan.schema}`);
    process.exit(1);
  }
  console.log(`    Schema: OK (${plan.schema})`);
  console.log('');

  if (args.dryRun) {
    console.log('  DRY RUN complete. Plan is valid.\n');
    process.exit(0);
  }

  // 4. Load config
  const config = loadFrameworkConfig(args);
  if (args.timeout) {
    config.timeouts.action = args.timeout;
  }
  if (config.pacing.globalDelayMs > 0) {
    console.log(`  Pacing: ${config.pacing.globalDelayMs}ms between steps`);
  }
  if (config.pacing.postNavWait !== '0') {
    console.log(`  Post-nav wait: ${config.pacing.postNavWait}`);
  }

  // 5. Launch browser
  const browserLauncher = { chromium, firefox, webkit }[args.browser];
  const browser: Browser = await browserLauncher.launch({
    headless: !args.headed,
  });

  const contextOptions = {
    ...getPopupSuppressingContextOptions(),
    viewport: { width: 1280, height: 720 },
  };
  const browserContext: BrowserContext = await browser.newContext(contextOptions);
  const page: Page = await browserContext.newPage();

  configureBrowserPopupHandling(page);

  const screenshotDir = path.resolve('output', 'screenshots');
  fs.mkdirSync(screenshotDir, { recursive: true });
  fs.mkdirSync(path.resolve('output', 'downloads'), { recursive: true });

  const handlerContext = {
    page,
    variables: context,
    config,
    screenshotDir,
  };

  // 6. Execute steps
  const stepResults: StepReportEntry[] = [];
  const screenshots: { name: string; step: number; file: string }[] = [];
  const allDismissals: string[] = [];
  let stopExecution = false;

  console.log('  Executing steps:\n');

  // Run setup steps
  if (plan.setup && plan.setup.length > 0) {
    console.log('  [Setup]');
    for (const setupStep of plan.setup) {
      const resolved = resolveDeep(setupStep, context);
      const handler = handlers[resolved.type];
      if (handler) {
        const result = await handler(resolved, handlerContext);
        console.log(`    Setup: ${resolved.description} — ${result.status.toUpperCase()}`);
      }
    }
    console.log('');
  }

  // Run main steps
  for (const step of plan.steps) {
    if (stopExecution) {
      stepResults.push({
        id: step.id,
        section: step.section || '',
        description: step.description,
        type: step.type,
        status: 'skip',
        duration: 0,
        evidence: 'Skipped due to prior stop',
      });
      continue;
    }

    // Update runtime context
    context._runtime.stepNumber = step.id;
    context._runtime.sectionName = step.section || '';

    // Resolve variables in step
    let resolvedStep: Step;
    try {
      resolvedStep = resolveDeep(step, context);
    } catch (error: any) {
      stepResults.push({
        id: step.id,
        section: step.section || '',
        description: step.description,
        type: step.type,
        status: 'fail',
        duration: 0,
        error: `Variable resolution failed: ${error.message}`,
      });
      if (step.onFailure === 'stop') stopExecution = true;
      continue;
    }

    // Execute
    const handler = handlers[resolvedStep.type];
    if (!handler) {
      stepResults.push({
        id: step.id,
        section: step.section || '',
        description: step.description,
        type: step.type,
        status: 'fail',
        duration: 0,
        error: `Unknown step type: ${step.type}`,
      });
      continue;
    }

    const result = await handler(resolvedStep, handlerContext);

    // Per-step pacing (from plan step or global config)
    const stepDelay = step.action?.waitAfter || config.pacing.globalDelayMs;
    if (stepDelay > 0) {
      await page.waitForTimeout(Number(stepDelay));
    }

    // Record result
    stepResults.push({
      id: step.id,
      section: step.section || '',
      description: step.description,
      type: step.type,
      status: result.status,
      duration: result.duration,
      evidence: result.evidence,
      error: result.error,
      screenshot: result.screenshot,
    });

    // Track dismissals
    if (result.dismissed) {
      allDismissals.push(...result.dismissed);
    }

    // Track screenshots
    if (result.screenshot && step.type === 'SCREENSHOT') {
      screenshots.push({
        name: step.action.name,
        step: step.id,
        file: result.screenshot,
      });
    }

    // Console output
    const icon = result.status === 'pass' ? '  PASS' : result.status === 'fail' ? '  FAIL' : '  SKIP';
    const timeStr = `${result.duration}ms`.padStart(6);
    console.log(`  ${String(step.id).padStart(3)}. ${icon} ${timeStr}  ${step.description.substring(0, 60)}`);
    if (result.status === 'fail' && result.error) {
      console.log(`                      Error: ${result.error.substring(0, 80)}`);
    }

    // Stop on failure if configured
    if (result.status === 'fail' && step.onFailure === 'stop') {
      stopExecution = true;
    }
  }

  // Run teardown steps
  if (plan.teardown && plan.teardown.length > 0) {
    console.log('\n  [Teardown]');
    for (const teardownStep of plan.teardown) {
      const resolved = resolveDeep(teardownStep, context);
      const handler = handlers[resolved.type];
      if (handler) {
        const result = await handler(resolved, handlerContext);
        console.log(`    Teardown: ${resolved.description} — ${result.status.toUpperCase()}`);
      }
    }
  }

  // 7. Close browser
  await page.close();
  await browserContext.close();
  await browser.close();

  // 8. Generate report
  const endTime = new Date();
  const totalDuration = endTime.getTime() - startTime.getTime();

  // Build captured variables for report (exclude internal namespaces)
  const capturedForReport: Record<string, any> = {};
  for (const [key, value] of Object.entries(context)) {
    if (!['ENV', 'testData', 'dataSources', '_runtime', '_downloads'].includes(key) && typeof value !== 'function') {
      capturedForReport[key] = value;
    }
  }

  const results: ReplayResults = {
    scenario: plan.scenario.name,
    planHash: plan.planHash,
    startTime: startTime.toISOString(),
    endTime: endTime.toISOString(),
    totalDuration,
    environment: {
      BASE_URL: context.ENV.BASE_URL || '',
      BROWSER: args.browser,
      HEADED: String(args.headed),
    },
    stepResults,
    capturedVariables: capturedForReport,
    screenshots,
    popupDismissals: allDismissals,
  };

  const reportPath = args.report
    || path.resolve('output', 'reports', `replay-report-${plan.scenario.name}.md`);
  const reportExt = args.reportFormat === 'junit' ? '.xml' : '.md';
  const finalReportPath = reportPath.endsWith(reportExt) ? reportPath : reportPath.replace(/\.\w+$/, reportExt);

  saveReport(results, finalReportPath, args.reportFormat);

  // 9. Print summary
  const passed = stepResults.filter(s => s.status === 'pass').length;
  const failed = stepResults.filter(s => s.status === 'fail').length;
  const skipped = stepResults.filter(s => s.status === 'skip').length;
  const total = stepResults.length;
  const verdict = failed === 0 ? 'PASS' : 'FAIL';

  console.log(`\n  ─────────────────────────────────────────────`);
  console.log(`  ${verdict}: ${passed}/${total} steps passed in ${(totalDuration / 1000).toFixed(1)}s`);
  if (failed > 0) console.log(`  Failed: ${failed} | Skipped: ${skipped}`);
  if (allDismissals.length > 0) console.log(`  Popups dismissed: ${allDismissals.length}`);
  console.log(`  Report: ${finalReportPath}`);
  console.log(`  ─────────────────────────────────────────────\n`);

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error(`\n  FATAL: ${error.message}\n`);
  process.exit(2);
});
