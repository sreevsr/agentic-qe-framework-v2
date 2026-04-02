/**
 * mobile-replay-engine.ts — Deterministic plan executor for mobile (Appium) scenarios.
 *
 * Mirrors replay-engine.ts but uses Appium MCP tools instead of Playwright.
 * Reads the same plan.json format — mobile steps use strategy+value targets.
 *
 * Prerequisites:
 *   1. Appium server running on APPIUM_HOST:APPIUM_PORT (default localhost:4723)
 *   2. Appium MCP server running (from mcp-servers/appium/)
 *   3. Device/emulator connected and visible via `adb devices` (Android) or Xcode (iOS)
 *
 * Usage:
 *   npx tsx scripts/mobile-replay-engine.ts --plan=output/plans/mobile/scenario.plan.json [options]
 *
 * Options:
 *   --plan=<path>         Path to execution plan JSON (required)
 *   --report=<path>       Report output path
 *   --report-format=<fmt> Report format: markdown (default), junit
 *   --data=<path>         Override test data file
 *   --dry-run             Validate plan without running
 *   --timeout=<ms>        Override default action timeout (default 15000)
 *   --pacing=<ms>         Global delay between steps (default 0)
 *   --post-action=<ms>    Wait after each action (default 500, for animations)
 */

import * as fs from 'fs';
import * as path from 'path';
import { buildContext, resolveDeep, validateEnvVariables, VariableContext } from './replay/variable-resolver';
import { mobileHandlers, MobileStepResult, MobileStep, MobileReplayConfig, MobileHandlerContext } from './replay/mobile-step-handlers';
import { generateMarkdownReport, generateJUnitXml, saveReport, ReplayResults, StepReportEntry } from './replay/report-generator';

// --- Argument Parsing ---

interface CliArgs {
  plan: string;
  report?: string;
  reportFormat: 'markdown' | 'junit';
  data?: string;
  dryRun: boolean;
  timeout: number;
  pacing: number;
  postAction: number;
}

function parseArgs(): CliArgs {
  const args: Record<string, string | boolean> = {};
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith('--')) {
      const [key, ...rest] = arg.slice(2).split('=');
      args[key] = rest.length > 0 ? rest.join('=') : true;
    }
  }

  if (!args.plan) {
    console.log(`Usage: npx tsx scripts/mobile-replay-engine.ts --plan=<path> [options]\n`);
    console.log(`Options:`);
    console.log(`  --report=<path>       Report output path`);
    console.log(`  --report-format=<fmt> Report format: markdown (default), junit`);
    console.log(`  --data=<path>         Override test data file`);
    console.log(`  --dry-run             Validate plan without running`);
    console.log(`  --timeout=<ms>        Action timeout (default 15000)`);
    console.log(`  --pacing=<ms>         Delay between steps (default 0)`);
    console.log(`  --post-action=<ms>    Wait after action (default 500)`);
    process.exit(0);
  }

  return {
    plan: args.plan as string,
    report: args.report as string | undefined,
    reportFormat: (args['report-format'] as 'markdown' | 'junit') || 'markdown',
    data: args.data as string | undefined,
    dryRun: !!args['dry-run'],
    timeout: Number(args.timeout) || 15000,
    pacing: Number(args.pacing) || 0,
    postAction: Number(args['post-action']) || 500,
  };
}

// --- MCP Bridge ---

/**
 * Creates a function that calls an Appium MCP tool.
 * In production, this connects to the MCP server via stdio.
 * For now, we use a subprocess call pattern.
 *
 * When running inside Claude Code or Copilot, the MCP tools are available
 * directly. For standalone terminal execution, we use the MCP client.
 */
async function createMcpBridge(): Promise<(tool: string, params: Record<string, any>) => Promise<any>> {
  // Try to import the MCP client
  // The Appium MCP server communicates via stdio — we start it as a child process
  const { spawn } = await import('child_process');

  const mcpServerPath = path.resolve('mcp-servers', 'appium', 'dist', 'index.js');
  if (!fs.existsSync(mcpServerPath)) {
    throw new Error(
      `Appium MCP server not found at: ${mcpServerPath}\n` +
      `Build it: cd mcp-servers/appium && npm run build\n` +
      `Or copy from: https://github.com/sreevsr/agentic-qe-framework-skills.git (feat/mobile-appium branch)`
    );
  }

  const appiumHost = process.env.APPIUM_HOST || 'localhost';
  const appiumPort = process.env.APPIUM_PORT || '4723';

  // Start MCP server as child process
  const mcpProcess = spawn('node', [mcpServerPath], {
    env: { ...process.env, APPIUM_HOST: appiumHost, APPIUM_PORT: appiumPort },
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  let requestId = 0;
  const pending = new Map<number, { resolve: Function; reject: Function }>();

  // Read responses from MCP server stdout
  let buffer = '';
  mcpProcess.stdout!.on('data', (data: Buffer) => {
    buffer += data.toString();
    // MCP uses JSON-RPC 2.0 — each message is a JSON line
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const msg = JSON.parse(line);
        if (msg.id !== undefined && pending.has(msg.id)) {
          const { resolve, reject } = pending.get(msg.id)!;
          pending.delete(msg.id);
          if (msg.error) {
            reject(new Error(msg.error.message || JSON.stringify(msg.error)));
          } else {
            resolve(msg.result);
          }
        }
      } catch {
        // Not a JSON line — skip
      }
    }
  });

  mcpProcess.stderr!.on('data', (data: Buffer) => {
    const msg = data.toString().trim();
    if (msg) console.log(`  [Appium MCP] ${msg}`);
  });

  // Send a tool call to the MCP server
  const callMcp = async (tool: string, params: Record<string, any>): Promise<any> => {
    const id = ++requestId;
    return new Promise((resolve, reject) => {
      const timerId = setTimeout(() => {
        if (pending.has(id)) {
          pending.delete(id);
          reject(new Error(`MCP tool call "${tool}" timed out after 30s`));
        }
      }, 30000);

      pending.set(id, {
        resolve: (val: any) => { clearTimeout(timerId); resolve(val); },
        reject: (err: any) => { clearTimeout(timerId); reject(err); },
      });

      const request = JSON.stringify({
        jsonrpc: '2.0',
        id,
        method: 'tools/call',
        params: { name: tool, arguments: params },
      }) + '\n';

      mcpProcess.stdin!.write(request);
    });
  };

  // Initialize the MCP connection
  const initRequest = JSON.stringify({
    jsonrpc: '2.0',
    id: ++requestId,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'mobile-replay-engine', version: '1.0.0' },
    },
  }) + '\n';
  mcpProcess.stdin!.write(initRequest);

  // Wait for init response
  await new Promise<void>((resolve, reject) => {
    pending.set(requestId, { resolve, reject });
    setTimeout(() => reject(new Error('MCP initialization timed out')), 10000);
  });

  // Send the required `initialized` notification (MCP protocol handshake completion)
  const initializedNotification = JSON.stringify({
    jsonrpc: '2.0',
    method: 'notifications/initialized',
  }) + '\n';
  mcpProcess.stdin!.write(initializedNotification);

  // Return the bridge function and a cleanup function
  (callMcp as any).cleanup = () => {
    mcpProcess.kill();
  };

  return callMcp;
}

// --- Shared Flow Resolution (same as web replay engine) ---

const MAX_INCLUDE_DEPTH = 5;
const mobileProjectRoot = path.resolve(__dirname, '..');

function resolveIncludes(steps: any[], depth: number = 0, visited: Set<string> = new Set()): any[] {
  if (depth > MAX_INCLUDE_DEPTH) {
    console.warn(`  Warning: INCLUDE depth limit reached`);
    return steps;
  }
  const resolved: any[] = [];
  for (const step of steps) {
    if (step.type === 'INCLUDE') {
      const flowPath = path.resolve(step.action.flow);
      if (!flowPath.startsWith(mobileProjectRoot)) {
        console.warn(`  Warning: INCLUDE path traversal blocked: ${step.action.flow}`);
        resolved.push({ ...step, type: 'REPORT', action: { message: `INCLUDE blocked: ${step.action.flow}` } });
        continue;
      }
      if (visited.has(flowPath)) {
        console.warn(`  Warning: Circular INCLUDE: ${step.action.flow}`);
        resolved.push({ ...step, type: 'REPORT', action: { message: `INCLUDE circular: ${step.action.flow}` } });
        continue;
      }
      if (!fs.existsSync(flowPath)) {
        console.warn(`  Warning: Shared flow not found: ${flowPath}`);
        resolved.push({ ...step, type: 'REPORT', action: { message: `INCLUDE not found: ${step.action.flow}` } });
        continue;
      }
      try {
        const fragment = JSON.parse(fs.readFileSync(flowPath, 'utf-8'));
        const fragmentSteps = fragment.steps || fragment;
        if (Array.isArray(fragmentSteps)) {
          console.log(`  Inlined shared flow: ${step.action.flow} (${fragmentSteps.length} steps)`);
          visited.add(flowPath);
          resolved.push(...resolveIncludes(fragmentSteps, depth + 1, visited));
        }
      } catch (err: any) {
        console.warn(`  Warning: Failed to parse shared flow: ${err.message}`);
        resolved.push(step);
      }
    } else {
      resolved.push(step);
    }
  }
  return resolved;
}

// --- Main ---

async function main() {
  const args = parseArgs();
  const startTime = new Date();
  console.log(`\n  Mobile Replay Engine v1.0`);
  console.log(`  Plan: ${args.plan}`);
  console.log(`  Mode: ${args.dryRun ? 'DRY RUN' : 'live'}\n`);

  // 1. Load plan
  const planPath = path.resolve(args.plan);
  if (!fs.existsSync(planPath)) {
    console.error(`Plan file not found: ${planPath}`);
    process.exit(1);
  }
  let plan: any;
  try {
    plan = JSON.parse(fs.readFileSync(planPath, 'utf-8'));
  } catch (err: any) {
    console.error(`Failed to parse plan JSON: ${err.message}`);
    process.exit(1);
  }

  // Resolve INCLUDEs
  plan.steps = resolveIncludes(plan.steps);
  if (plan.setup) plan.setup = resolveIncludes(plan.setup);
  if (plan.teardown) plan.teardown = resolveIncludes(plan.teardown);

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
    for (const [name, source] of Object.entries(plan.dataSources as Record<string, any>)) {
      const filePath = path.resolve(source.file);
      if (fs.existsSync(filePath)) {
        dataSources[name] = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      }
    }
  }

  const context = buildContext(envPath, testDataOverride, dataSources);

  // 3. Pre-flight validation
  console.log('  Pre-flight checks:');
  const missingEnv = validateEnvVariables(plan.environment?.variables || [], context);
  if (missingEnv.length > 0) {
    console.error(`  FAIL: Missing environment variables: ${missingEnv.join(', ')}`);
    process.exit(1);
  }
  console.log(`    ENV variables: OK`);
  console.log(`    Schema: OK (${plan.schema})\n`);

  if (args.dryRun) {
    console.log('  DRY RUN complete. Plan is valid.\n');
    process.exit(0);
  }

  // 4. Build config
  const config: MobileReplayConfig = {
    timeouts: {
      action: args.timeout,
      launch: 60000,
      test: 300000,
    },
    screenshotOnFailure: true,
    pacing: {
      globalDelayMs: args.pacing,
      postActionWait: args.postAction,
    },
  };

  // 5. Create MCP bridge to Appium
  console.log('  Connecting to Appium MCP server...');
  let callMcp: (tool: string, params: Record<string, any>) => Promise<any>;
  try {
    callMcp = await createMcpBridge();
    mcpCleanupFn = (callMcp as any).cleanup || null;
    console.log('  Appium MCP: connected\n');
  } catch (err: any) {
    console.error(`  FAIL: Cannot connect to Appium MCP server: ${err.message}`);
    process.exit(2);
  }

  const screenshotDir = path.resolve('output', 'screenshots', 'mobile');
  fs.mkdirSync(screenshotDir, { recursive: true });

  const handlerContext: MobileHandlerContext = {
    callMcp,
    variables: context,
    config,
    screenshotDir,
  };

  // 6. Execute steps
  const stepResults: StepReportEntry[] = [];
  const screenshots: { name: string; step: number; file: string }[] = [];
  let stopExecution = false;

  console.log('  Executing steps:\n');

  // Run setup
  if (plan.setup && plan.setup.length > 0) {
    for (const setupStep of plan.setup) {
      const resolved = resolveDeep(setupStep, context);
      const handler = mobileHandlers[resolved.type];
      if (handler) {
        const result = await handler(resolved, handlerContext);
        console.log(`    Setup: ${resolved.description} — ${result.status.toUpperCase()}`);
      }
    }
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

    context._runtime.stepNumber = step.id;
    context._runtime.sectionName = step.section || '';

    let resolvedStep: MobileStep;
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

    const handler = mobileHandlers[resolvedStep.type];
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

    // Pacing
    if (config.pacing.globalDelayMs > 0) {
      await new Promise(resolve => setTimeout(resolve, config.pacing.globalDelayMs));
    }

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

    if (result.screenshot && step.type === 'SCREENSHOT') {
      screenshots.push({ name: step.action.name, step: step.id, file: result.screenshot });
    }

    const icon = result.status === 'pass' ? '  PASS' : result.status === 'fail' ? '  FAIL' : '  SKIP';
    const time = `${result.duration}ms`.padStart(7);
    console.log(`  ${String(step.id).padStart(3)}. ${icon} ${time}  ${step.description}`);
    if (result.error) console.log(`                     ${result.error.substring(0, 80)}`);

    if (result.status === 'fail' && step.onFailure === 'stop') {
      stopExecution = true;
    }
  }

  // Run teardown
  if (plan.teardown && plan.teardown.length > 0) {
    for (const teardownStep of plan.teardown) {
      const resolved = resolveDeep(teardownStep, context);
      const handler = mobileHandlers[resolved.type];
      if (handler) {
        const result = await handler(resolved, handlerContext);
        console.log(`    Teardown: ${resolved.description} — ${result.status.toUpperCase()}`);
      }
    }
  }

  // 7. Cleanup MCP
  if ((callMcp as any).cleanup) {
    (callMcp as any).cleanup();
  }

  // 8. Generate report
  const endTime = new Date();
  const totalDuration = endTime.getTime() - startTime.getTime();
  const hasFailures = stepResults.some(s => s.status === 'fail');

  const capturedForReport: Record<string, any> = {};
  for (const [key, value] of Object.entries(context)) {
    if (!['ENV', 'testData', 'dataSources', '_runtime', '_downloads'].includes(key) && typeof value !== 'function') {
      capturedForReport[key] = value;
    }
  }

  const results: ReplayResults = {
    scenario: plan.scenario.name,
    planHash: plan.planHash || '',
    startTime: startTime.toISOString(),
    endTime: endTime.toISOString(),
    totalDuration,
    environment: {
      PLATFORM: context.ENV.PLATFORM || 'android',
      DEVICE: context.ENV.ANDROID_DEVICE || context.ENV.IOS_DEVICE || 'unknown',
      APP: context.ENV.APP_PACKAGE || context.ENV.IOS_BUNDLE_ID || 'unknown',
    },
    stepResults,
    capturedVariables: capturedForReport,
    screenshots,
    popupDismissals: [],
  };

  const reportPath = args.report
    || path.resolve('output', 'reports', `replay-report-${plan.scenario.name}.md`);
  const reportExt = args.reportFormat === 'junit' ? '.xml' : '.md';
  const finalReportPath = reportPath.endsWith(reportExt) ? reportPath : reportPath.replace(/\.\w+$/, reportExt);

  const planTags: string[] = plan.scenario?.tags || [];
  saveReport(results, finalReportPath, args.reportFormat, planTags);

  // 9. Print summary
  const passed = stepResults.filter(s => s.status === 'pass').length;
  const failed = stepResults.filter(s => s.status === 'fail').length;
  const skipped = stepResults.filter(s => s.status === 'skip').length;
  const total = stepResults.length;
  const verdict = failed === 0 ? 'PASS' : 'FAIL';

  console.log(`\n  ${'─'.repeat(45)}`);
  console.log(`  ${verdict}: ${passed}/${total} steps passed in ${(totalDuration / 1000).toFixed(1)}s`);
  if (failed > 0) console.log(`  Failed: ${failed} | Skipped: ${skipped}`);
  console.log(`  Report: ${finalReportPath}`);
  console.log(`  ${'─'.repeat(45)}\n`);

  process.exit(failed > 0 ? 1 : 0);
}

// Ensure MCP cleanup on any exit
let mcpCleanupFn: (() => void) | null = null;
process.on('exit', () => { if (mcpCleanupFn) mcpCleanupFn(); });
process.on('SIGINT', () => { if (mcpCleanupFn) mcpCleanupFn(); process.exit(130); });
process.on('SIGTERM', () => { if (mcpCleanupFn) mcpCleanupFn(); process.exit(143); });

main().catch((err) => {
  console.error('Fatal error:', err.message);
  if (mcpCleanupFn) mcpCleanupFn();
  process.exit(2);
});
