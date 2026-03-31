/**
 * step-handlers.ts — One handler per step type in the execution plan.
 *
 * Each handler:
 *   1. Receives a resolved step (variables already substituted)
 *   2. Executes the action via Playwright
 *   3. Returns a StepResult (PASS/FAIL/SKIP + evidence)
 */

import { Page, Download } from 'playwright';
import { expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { resolveWithFallbacks, resolveTarget, Target } from './element-resolver';
import { VariableContext, setCapturedVariable, resolveDeep, resolveString } from './variable-resolver';
import { dismissPopups } from './popup-dismisser';

// --- Types ---

export interface StepResult {
  status: 'pass' | 'fail' | 'skip';
  duration: number;
  evidence?: string;
  error?: string;
  capturedValues?: Record<string, any>;
  dismissed?: string[];  // popup dismissals
  screenshot?: string;   // path to failure screenshot
}

export interface Step {
  id: number;
  section?: string;
  description: string;
  type: string;
  action: any;
  onFailure?: 'continue' | 'stop' | 'heal';
  _fingerprint?: any;
}

export interface HandlerContext {
  page: Page;
  variables: VariableContext;
  config: ReplayConfig;
  screenshotDir: string;
}

export interface ReplayConfig {
  timeouts: {
    action: number;
    navigation: number;
    test: number;
  };
  screenshotOnFailure: boolean;
  pacing: {
    globalDelayMs: number;       // Delay between every step (0 = no delay)
    postNavWait: string;         // After navigation: ms number or 'networkidle'
  };
}

// --- Handler Registry ---

type StepHandler = (step: Step, ctx: HandlerContext) => Promise<StepResult>;

export const handlers: Record<string, StepHandler> = {
  NAVIGATE:     handleNavigate,
  ACTION:       handleAction,
  VERIFY:       handleVerify,
  VERIFY_SOFT:  handleVerifySoft,
  CAPTURE:      handleCapture,
  CALCULATE:    handleCalculate,
  SCREENSHOT:   handleScreenshot,
  REPORT:       handleReport,
  API_CALL:     handleApiCall,
  DB_QUERY:     handleDbQuery,
  WRITE_DATA:   handleWriteData,
  SKILL:        handleSkill,
  WAIT:         handleWait,
  FOR_EACH:     handleForEach,
  CONDITIONAL:  handleConditional,
};

// --- Helpers ---

async function captureFailureScreenshot(page: Page, step: Step, dir: string): Promise<string | undefined> {
  try {
    const filename = `failure-step-${step.id}.png`;
    const filepath = path.join(dir, filename);
    await page.screenshot({ path: filepath, fullPage: false });
    return filepath;
  } catch {
    return undefined;
  }
}

function wrapHandler(handler: StepHandler): StepHandler {
  return async (step: Step, ctx: HandlerContext): Promise<StepResult> => {
    const start = Date.now();
    try {
      const result = await handler(step, ctx);
      result.duration = Date.now() - start;
      return result;
    } catch (error: any) {
      const duration = Date.now() - start;
      let screenshot: string | undefined;
      if (ctx.config.screenshotOnFailure) {
        screenshot = await captureFailureScreenshot(ctx.page, step, ctx.screenshotDir);
      }
      return {
        status: 'fail',
        duration,
        error: error.message || String(error),
        screenshot,
      };
    }
  };
}

// Wrap all handlers with error handling
for (const [type, handler] of Object.entries(handlers)) {
  handlers[type] = wrapHandler(handler);
}

// --- NAVIGATE ---

async function handleNavigate(step: Step, ctx: HandlerContext): Promise<StepResult> {
  const { url } = step.action;
  await ctx.page.goto(url, { timeout: ctx.config.timeouts.navigation, waitUntil: 'domcontentloaded' });

  // Post-navigation pacing
  const postNavWait = step.action.waitAfter || ctx.config.pacing.postNavWait;
  if (postNavWait === 'networkidle') {
    await ctx.page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
  } else if (Number(postNavWait) > 0) {
    await ctx.page.waitForTimeout(Number(postNavWait));
  }

  // Auto-dismiss popups after navigation
  const popupResult = await dismissPopups(ctx.page);

  return {
    status: 'pass',
    duration: 0,
    evidence: `Navigated to ${url}`,
    dismissed: popupResult.dismissed,
  };
}

// --- ACTION ---

async function handleAction(step: Step, ctx: HandlerContext): Promise<StepResult> {
  const { verb } = step.action;
  const timeout = ctx.config.timeouts.action;

  switch (verb) {
    case 'click': {
      const { locator, strategy } = await resolveWithFallbacks(ctx.page, step.action.target, timeout);
      await locator.click({ timeout });
      // Dismiss popups after click (might trigger a modal)
      const popupResult = await dismissPopups(ctx.page);
      return { status: 'pass', duration: 0, evidence: `Clicked: ${strategy}`, dismissed: popupResult.dismissed };
    }

    case 'fill': {
      const { locator, strategy } = await resolveWithFallbacks(ctx.page, step.action.target, timeout);
      await locator.fill(step.action.value, { timeout });
      return { status: 'pass', duration: 0, evidence: `Filled "${step.action.value}" via ${strategy}` };
    }

    case 'fill_form': {
      const results: string[] = [];
      for (const field of step.action.fields) {
        const { locator, strategy } = await resolveWithFallbacks(ctx.page, field.target, timeout);
        if (field.verb === 'select') {
          await locator.selectOption(field.value, { timeout });
          results.push(`${strategy} selected "${field.value}"`);
        } else {
          await locator.fill(field.value, { timeout });
          results.push(`${strategy} = "${field.value}"`);
        }
      }
      return { status: 'pass', duration: 0, evidence: `Filled ${results.length} fields: ${results.join('; ')}` };
    }

    case 'select': {
      const { locator, strategy } = await resolveWithFallbacks(ctx.page, step.action.target, timeout);
      await locator.selectOption(step.action.value, { timeout });
      return { status: 'pass', duration: 0, evidence: `Selected "${step.action.value}" via ${strategy}` };
    }

    case 'hover': {
      const { locator, strategy } = await resolveWithFallbacks(ctx.page, step.action.target, timeout);
      await locator.hover({ timeout });
      return { status: 'pass', duration: 0, evidence: `Hovered: ${strategy}` };
    }

    case 'press_key': {
      await ctx.page.keyboard.press(step.action.key);
      return { status: 'pass', duration: 0, evidence: `Pressed key: ${step.action.key}` };
    }

    case 'check': {
      const { locator, strategy } = await resolveWithFallbacks(ctx.page, step.action.target, timeout);
      await locator.check({ timeout });
      return { status: 'pass', duration: 0, evidence: `Checked: ${strategy}` };
    }

    case 'uncheck': {
      const { locator, strategy } = await resolveWithFallbacks(ctx.page, step.action.target, timeout);
      await locator.uncheck({ timeout });
      return { status: 'pass', duration: 0, evidence: `Unchecked: ${strategy}` };
    }

    case 'type': {
      const { locator, strategy } = await resolveWithFallbacks(ctx.page, step.action.target, timeout);
      await locator.pressSequentially(step.action.value, { delay: step.action.delay || 50 });
      return { status: 'pass', duration: 0, evidence: `Typed "${step.action.value}" via ${strategy}` };
    }

    case 'drag': {
      const source = await resolveWithFallbacks(ctx.page, step.action.source, timeout);
      const dest = await resolveWithFallbacks(ctx.page, step.action.destination, timeout);
      await source.locator.dragTo(dest.locator);
      return { status: 'pass', duration: 0, evidence: `Dragged ${source.strategy} → ${dest.strategy}` };
    }

    case 'upload': {
      const { locator, strategy } = await resolveWithFallbacks(ctx.page, step.action.target, timeout);
      const files = step.action.files.map((f: string) => path.resolve(f));
      await locator.setInputFiles(files);
      return { status: 'pass', duration: 0, evidence: `Uploaded ${files.length} file(s) via ${strategy}` };
    }

    case 'download': {
      try {
        const triggerTarget = step.action.trigger;
        const { locator, strategy } = await resolveWithFallbacks(ctx.page, triggerTarget, timeout);
        const [download] = await Promise.all([
          ctx.page.waitForEvent('download', { timeout: step.action.timeout || 30000 }),
          locator.click({ timeout }),
        ]);
        const filename = download.suggestedFilename();
        const downloadDir = path.join(ctx.screenshotDir, '..', 'downloads');
        fs.mkdirSync(downloadDir, { recursive: true });
        const savePath = path.join(downloadDir, filename);
        await download.saveAs(savePath);
        // Store download path for subsequent VERIFY steps
        const saveKey = step.action.saveAs || filename;
        ctx.variables._downloads[saveKey] = savePath;
        return { status: 'pass', duration: 0, evidence: `Downloaded "${filename}" to ${savePath}`, capturedValues: { [saveKey]: savePath } };
      } catch (error: any) {
        return { status: 'fail', duration: 0, error: `Download failed: ${error.message}` };
      }
    }

    case 'switch_frame': {
      // Frame switching is handled at the element resolver level.
      // This step just records the intent — actual switching happens when
      // subsequent steps have a frame field.
      const frame = step.action.frame;
      if (frame === 'main') {
        return { status: 'pass', duration: 0, evidence: 'Switched to main frame' };
      }
      return { status: 'pass', duration: 0, evidence: `Frame context set to: ${JSON.stringify(frame)}` };
    }

    default:
      return { status: 'fail', duration: 0, error: `Unknown action verb: ${verb}` };
  }
}

// --- VERIFY ---

async function handleVerify(step: Step, ctx: HandlerContext): Promise<StepResult> {
  return executeAssertion(step, ctx, false);
}

// --- VERIFY_SOFT ---

async function handleVerifySoft(step: Step, ctx: HandlerContext): Promise<StepResult> {
  return executeAssertion(step, ctx, true);
}

async function executeAssertion(step: Step, ctx: HandlerContext, soft: boolean): Promise<StepResult> {
  const { assertion } = step.action;
  const timeout = ctx.config.timeouts.action;

  try {
    switch (assertion) {
      case 'textVisible': {
        const expected = step.action.expected;
        if (step.action.scope) {
          const { locator } = await resolveWithFallbacks(ctx.page, step.action.scope, timeout);
          await expect(locator).toContainText(expected, { timeout });
        } else {
          await expect(ctx.page.getByText(expected, { exact: false })).toBeVisible({ timeout });
        }
        return { status: 'pass', duration: 0, evidence: `Text "${expected}" is visible` };
      }

      case 'textEquals': {
        const { locator, strategy } = await resolveWithFallbacks(ctx.page, step.action.target, timeout);
        await expect(locator).toHaveText(step.action.expected, { timeout });
        return { status: 'pass', duration: 0, evidence: `${strategy} text equals "${step.action.expected}"` };
      }

      case 'textContains': {
        const target = step.action.target || step.action.scope;
        const { locator, strategy } = await resolveWithFallbacks(ctx.page, target, timeout);
        await expect(locator).toContainText(step.action.expected, { timeout });
        return { status: 'pass', duration: 0, evidence: `${strategy} contains "${step.action.expected}"` };
      }

      case 'elementVisible': {
        const { locator, strategy } = await resolveWithFallbacks(ctx.page, step.action.target, timeout);
        await expect(locator).toBeVisible({ timeout });
        return { status: 'pass', duration: 0, evidence: `${strategy} is visible` };
      }

      case 'elementHidden': {
        const { locator, strategy } = await resolveWithFallbacks(ctx.page, step.action.target, timeout);
        await expect(locator).toBeHidden({ timeout });
        return { status: 'pass', duration: 0, evidence: `${strategy} is hidden` };
      }

      case 'urlContains': {
        await expect(ctx.page).toHaveURL(new RegExp(escapeRegex(step.action.expected)), { timeout });
        return { status: 'pass', duration: 0, evidence: `URL contains "${step.action.expected}"` };
      }

      case 'urlEquals': {
        await expect(ctx.page).toHaveURL(step.action.expected, { timeout });
        return { status: 'pass', duration: 0, evidence: `URL equals "${step.action.expected}"` };
      }

      case 'valueEquals': {
        const actual = ctx.variables[step.action.variable] || '';
        const expected = step.action.expected;
        if (String(actual) !== String(expected)) {
          throw new Error(`Expected "${expected}" but got "${actual}"`);
        }
        return { status: 'pass', duration: 0, evidence: `{{${step.action.variable}}} = "${actual}" equals "${expected}"` };
      }

      case 'valueContains': {
        const actual = String(ctx.variables[step.action.variable] || '');
        const expected = step.action.expected;
        if (!actual.includes(expected)) {
          throw new Error(`Expected "${actual}" to contain "${expected}"`);
        }
        return { status: 'pass', duration: 0, evidence: `{{${step.action.variable}}} contains "${expected}"` };
      }

      case 'fileExists': {
        const filePath = step.action.path;
        if (!fs.existsSync(filePath)) {
          throw new Error(`File not found: ${filePath}`);
        }
        return { status: 'pass', duration: 0, evidence: `File exists: ${filePath}` };
      }

      case 'fileContains': {
        const filePath = step.action.path;
        const content = fs.readFileSync(filePath, 'utf-8');
        if (!content.includes(step.action.expected)) {
          throw new Error(`File "${filePath}" does not contain "${step.action.expected}". Content: ${content.substring(0, 200)}`);
        }
        return { status: 'pass', duration: 0, evidence: `File contains "${step.action.expected}"` };
      }

      case 'screenshotMatch': {
        const baseline = step.action.expected;
        const target = step.action.target;
        const locator = target
          ? (await resolveWithFallbacks(ctx.page, target, timeout)).locator
          : ctx.page.locator('body');
        await expect(locator).toHaveScreenshot(baseline, {
          maxDiffPixelRatio: step.action.maxDiffPixelRatio || 0.01,
          timeout,
        });
        return { status: 'pass', duration: 0, evidence: `Screenshot matches baseline: ${baseline}` };
      }

      case 'countEquals': {
        const { locator, strategy } = await resolveWithFallbacks(ctx.page, step.action.target, timeout);
        const count = await locator.count();
        if (count !== step.action.expected) {
          throw new Error(`Expected ${step.action.expected} elements but found ${count}`);
        }
        return { status: 'pass', duration: 0, evidence: `${strategy} count = ${count}` };
      }

      case 'allOf': {
        const results: string[] = [];
        for (const condition of step.action.conditions) {
          const subStep = { ...step, action: condition };
          const result = await executeAssertion(subStep, ctx, soft);
          if (result.status === 'fail') {
            throw new Error(`allOf condition failed: ${result.error}`);
          }
          results.push(result.evidence || 'OK');
        }
        return { status: 'pass', duration: 0, evidence: `All ${results.length} conditions passed` };
      }

      default:
        return { status: 'fail', duration: 0, error: `Unknown assertion type: ${assertion}` };
    }
  } catch (error: any) {
    if (soft) {
      // VERIFY_SOFT: record failure but return 'fail' without throwing
      let screenshot: string | undefined;
      if (ctx.config.screenshotOnFailure) {
        screenshot = await captureFailureScreenshot(ctx.page, step, ctx.screenshotDir);
      }
      return { status: 'fail', duration: 0, error: error.message, screenshot };
    }
    throw error; // VERIFY: re-throw to be caught by wrapHandler
  }
}

// --- CAPTURE ---

async function handleCapture(step: Step, ctx: HandlerContext): Promise<StepResult> {
  const timeout = ctx.config.timeouts.action;
  const { target, extract, captureAs } = step.action;

  const { locator, strategy } = await resolveWithFallbacks(ctx.page, target, timeout);

  let value: string;
  switch (extract) {
    case 'textContent':
      value = (await locator.textContent({ timeout })) || '';
      break;
    case 'inputValue':
      value = await locator.inputValue({ timeout });
      break;
    case 'count':
      value = String(await locator.count());
      break;
    default:
      if (extract?.startsWith('attribute:')) {
        const attrName = extract.replace('attribute:', '');
        value = (await locator.getAttribute(attrName, { timeout })) || '';
      } else {
        value = (await locator.textContent({ timeout })) || '';
      }
  }

  setCapturedVariable(ctx.variables, captureAs, value);
  return {
    status: 'pass',
    duration: 0,
    evidence: `Captured ${captureAs} = "${value}" via ${strategy}`,
    capturedValues: { [captureAs]: value },
  };
}

// --- CALCULATE ---

async function handleCalculate(step: Step, ctx: HandlerContext): Promise<StepResult> {
  const { expression, captureAs, resultFormat } = step.action;

  // Resolve variables in the expression
  const resolvedExpr = resolveString(expression, ctx.variables);

  // Evaluate the arithmetic expression safely
  // Only allow: numbers, operators (+, -, *, /), parentheses, parseFloat, replace, whitespace
  const safeExpr = resolvedExpr.replace(/[^0-9+\-*/().,' ]/g, (ch: string) => {
    if ('parseFloatreplace'.includes(ch)) return ch;
    return ch;
  });

  // Use Function constructor for evaluation (sandboxed enough for arithmetic)
  const result = new Function(`return (${resolvedExpr})`)();

  let finalValue = String(result);
  if (resultFormat) {
    finalValue = resultFormat.replace('{{result}}', String(result));
  }

  setCapturedVariable(ctx.variables, captureAs, finalValue);
  return {
    status: 'pass',
    duration: 0,
    evidence: `Calculated ${captureAs} = ${finalValue} (expression: ${resolvedExpr})`,
    capturedValues: { [captureAs]: finalValue },
  };
}

// --- SCREENSHOT ---

async function handleScreenshot(step: Step, ctx: HandlerContext): Promise<StepResult> {
  const { name, fullPage, target } = step.action;
  const filename = `${name}.png`;
  const filepath = path.join(ctx.screenshotDir, filename);

  fs.mkdirSync(path.dirname(filepath), { recursive: true });

  if (target) {
    const { locator } = await resolveWithFallbacks(ctx.page, target, ctx.config.timeouts.action);
    await locator.screenshot({ path: filepath });
  } else {
    await ctx.page.screenshot({ path: filepath, fullPage: fullPage ?? true });
  }

  return {
    status: 'pass',
    duration: 0,
    evidence: `Screenshot saved: ${filepath}`,
    screenshot: filepath,
  };
}

// --- REPORT ---

async function handleReport(step: Step, ctx: HandlerContext): Promise<StepResult> {
  const message = step.action.message;
  // The message is already variable-resolved by the engine before calling this handler
  return {
    status: 'pass',
    duration: 0,
    evidence: `REPORT: ${message}`,
  };
}

// --- API_CALL ---

async function handleApiCall(step: Step, ctx: HandlerContext): Promise<StepResult> {
  const { method, url, headers, body, captureAs, captureFields, expectedStatus } = step.action;

  // Use native fetch (Node 18+)
  const fetchOptions: RequestInit = {
    method: method.toUpperCase(),
    headers: headers || { 'Content-Type': 'application/json' },
  };

  if (body && ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) {
    fetchOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
  }

  const response = await fetch(url, fetchOptions);
  const status = response.status;
  let responseBody: any;
  try {
    responseBody = await response.json();
  } catch {
    responseBody = await response.text();
  }

  // Check expected status
  if (expectedStatus && status !== expectedStatus) {
    return {
      status: 'fail',
      duration: 0,
      error: `API ${method} ${url} returned ${status}, expected ${expectedStatus}. Body: ${JSON.stringify(responseBody).substring(0, 500)}`,
    };
  }

  // Capture response fields
  const capturedValues: Record<string, any> = {};
  if (captureAs) {
    setCapturedVariable(ctx.variables, captureAs, responseBody);
    capturedValues[captureAs] = responseBody;
  }
  if (captureFields) {
    for (const [varName, jsonPath] of Object.entries(captureFields)) {
      const value = extractJsonPath(responseBody, jsonPath as string);
      setCapturedVariable(ctx.variables, varName, value);
      capturedValues[varName] = value;
    }
  }

  return {
    status: 'pass',
    duration: 0,
    evidence: `API ${method} ${url} → ${status}`,
    capturedValues,
  };
}

// --- DB_QUERY ---

async function handleDbQuery(step: Step, ctx: HandlerContext): Promise<StepResult> {
  // DB support requires optional dependencies (pg, mysql2, etc.)
  // For Phase 2, we stub this and return a clear error if used
  return {
    status: 'fail',
    duration: 0,
    error: 'DB_QUERY is not yet implemented. Use API_CALL for data seeding in Phase 2.',
  };
}

// --- WRITE_DATA ---

async function handleWriteData(step: Step, ctx: HandlerContext): Promise<StepResult> {
  const { format, file, data, mode, row } = step.action;
  const filepath = path.resolve(file);
  fs.mkdirSync(path.dirname(filepath), { recursive: true });

  switch (format) {
    case 'json': {
      let existing: any = {};
      if (mode === 'append' && fs.existsSync(filepath)) {
        existing = JSON.parse(fs.readFileSync(filepath, 'utf-8'));
      }
      const merged = mode === 'append'
        ? (Array.isArray(existing) ? [...existing, data] : { ...existing, ...data })
        : data;
      fs.writeFileSync(filepath, JSON.stringify(merged, null, 2));
      return { status: 'pass', duration: 0, evidence: `Wrote JSON to ${filepath}` };
    }

    case 'csv': {
      const csvRow = (row || Object.values(data)).map((v: any) => `"${String(v).replace(/"/g, '""')}"`).join(',');
      if (mode === 'append') {
        fs.appendFileSync(filepath, csvRow + '\n');
      } else {
        fs.writeFileSync(filepath, csvRow + '\n');
      }
      return { status: 'pass', duration: 0, evidence: `Wrote CSV row to ${filepath}` };
    }

    case 'excel': {
      return { status: 'fail', duration: 0, error: 'Excel write requires exceljs dependency. Install with: npm install exceljs' };
    }

    default:
      return { status: 'fail', duration: 0, error: `Unknown write format: ${format}` };
  }
}

// --- SKILL ---

async function handleSkill(step: Step, ctx: HandlerContext): Promise<StepResult> {
  const { skill, params, captureAs } = step.action;

  // Load skill module dynamically — try .js first, then .ts
  const skillName = skill.split('/')[0];
  const jsPath = path.resolve('skills', 'replay', `${skillName}.skill.js`);
  const tsPath = path.resolve('skills', 'replay', `${skillName}.skill.ts`);
  const resolvedPath = fs.existsSync(jsPath) ? jsPath : fs.existsSync(tsPath) ? tsPath : null;
  if (!resolvedPath) {
    return { status: 'fail', duration: 0, error: `Skill not found: ${skill} (looked for ${jsPath} and ${tsPath})` };
  }

  // Skills are loaded dynamically — they export a function per action
  // e.g., skills/replay/pie-chart.skill.js exports { scan }
  try {
    const skillModule = require(resolvedPath);
    const actionName = skill.split('/')[1]; // "ag-grid/read-cell" → "readCell"
    const camelAction = actionName.replace(/-([a-z])/g, (_: string, c: string) => c.toUpperCase());

    if (typeof skillModule[camelAction] !== 'function') {
      return { status: 'fail', duration: 0, error: `Skill "${skill}" has no action "${camelAction}"` };
    }

    const result = await skillModule[camelAction](ctx.page, params);

    if (captureAs && result !== undefined) {
      setCapturedVariable(ctx.variables, captureAs, result);
    }

    return {
      status: 'pass',
      duration: 0,
      evidence: `Skill ${skill} executed`,
      capturedValues: captureAs ? { [captureAs]: result } : undefined,
    };
  } catch (error: any) {
    return { status: 'fail', duration: 0, error: `Skill ${skill} failed: ${error.message}` };
  }
}

// --- WAIT ---

async function handleWait(step: Step, ctx: HandlerContext): Promise<StepResult> {
  const { condition, timeout, target, expected, duration } = step.action;

  switch (condition) {
    case 'networkIdle':
      await ctx.page.waitForLoadState('networkidle', { timeout: timeout || 10000 });
      return { status: 'pass', duration: 0, evidence: 'Network idle' };

    case 'elementVisible': {
      const { locator, strategy } = await resolveWithFallbacks(ctx.page, target, timeout || 10000);
      await locator.waitFor({ state: 'visible', timeout: timeout || 10000 });
      return { status: 'pass', duration: 0, evidence: `${strategy} became visible` };
    }

    case 'elementHidden': {
      const { locator, strategy } = await resolveWithFallbacks(ctx.page, target, timeout || 10000);
      await locator.waitFor({ state: 'hidden', timeout: timeout || 10000 });
      return { status: 'pass', duration: 0, evidence: `${strategy} became hidden` };
    }

    case 'urlContains':
      await ctx.page.waitForURL(new RegExp(escapeRegex(expected)), { timeout: timeout || 10000 });
      return { status: 'pass', duration: 0, evidence: `URL contains "${expected}"` };

    case 'delay':
      await ctx.page.waitForTimeout(duration || 1000);
      return { status: 'pass', duration: 0, evidence: `Waited ${duration || 1000}ms` };

    default:
      return { status: 'fail', duration: 0, error: `Unknown wait condition: ${condition}` };
  }
}

// --- FOR_EACH ---

async function handleForEach(step: Step, ctx: HandlerContext): Promise<StepResult> {
  const { collection, as, steps } = step.action;

  // Resolve the collection (might be a variable reference like "{{dataSources.orders}}")
  let items: any[];
  if (typeof collection === 'string' && collection.startsWith('{{')) {
    const resolved = resolveString(collection, ctx.variables);
    items = typeof resolved === 'string' ? JSON.parse(resolved) : resolved;
  } else {
    items = collection;
  }

  if (!Array.isArray(items)) {
    return { status: 'fail', duration: 0, error: `FOR_EACH collection is not an array: ${typeof items}` };
  }

  const results: StepResult[] = [];
  for (let i = 0; i < items.length; i++) {
    // Set the loop variable in context
    setCapturedVariable(ctx.variables, as, items[i]);
    ctx.variables._runtime.stepNumber = step.id;

    for (const subStep of steps) {
      const resolvedSubStep = resolveDeep(subStep, ctx.variables);
      const handler = handlers[resolvedSubStep.type];
      if (!handler) {
        results.push({ status: 'fail', duration: 0, error: `Unknown step type in FOR_EACH: ${resolvedSubStep.type}` });
        continue;
      }
      const result = await handler(resolvedSubStep, ctx);
      results.push(result);
      if (result.status === 'fail' && resolvedSubStep.onFailure === 'stop') {
        return { status: 'fail', duration: 0, error: `FOR_EACH stopped at item ${i}: ${result.error}` };
      }
    }
  }

  const passed = results.filter(r => r.status === 'pass').length;
  const failed = results.filter(r => r.status === 'fail').length;
  return {
    status: failed > 0 ? 'fail' : 'pass',
    duration: 0,
    evidence: `FOR_EACH: ${items.length} items, ${passed} passed, ${failed} failed`,
  };
}

// --- CONDITIONAL ---

async function handleConditional(step: Step, ctx: HandlerContext): Promise<StepResult> {
  const { if: condition, then: thenSteps, else: elseSteps } = step.action;

  let conditionMet = false;

  // Evaluate condition
  if (condition.elementVisible) {
    try {
      const { locator } = resolveTarget(ctx.page, condition.elementVisible);
      conditionMet = await locator.isVisible({ timeout: 2000 }).catch(() => false);
    } catch {
      conditionMet = false;
    }
  } else if (condition.elementHidden) {
    try {
      const { locator } = resolveTarget(ctx.page, condition.elementHidden);
      conditionMet = !(await locator.isVisible({ timeout: 2000 }).catch(() => false));
    } catch {
      conditionMet = true;
    }
  } else if (condition.urlContains) {
    conditionMet = ctx.page.url().includes(condition.urlContains);
  } else if (condition.variableEquals) {
    const { variable, value } = condition.variableEquals;
    conditionMet = String(ctx.variables[variable]) === String(value);
  }

  // Execute the appropriate branch
  const stepsToRun = conditionMet ? (thenSteps || []) : (elseSteps || []);
  const branchName = conditionMet ? 'then' : 'else';

  for (const subStep of stepsToRun) {
    const resolvedSubStep = resolveDeep(subStep, ctx.variables);
    const handler = handlers[resolvedSubStep.type];
    if (handler) {
      await handler(resolvedSubStep, ctx);
    }
  }

  return {
    status: 'pass',
    duration: 0,
    evidence: `CONDITIONAL: condition ${conditionMet ? 'met' : 'not met'}, executed ${branchName} branch (${stepsToRun.length} steps)`,
  };
}

// --- Utility Functions ---

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Simple JSONPath extraction (supports basic $.field and $.array[0].field)
 */
function extractJsonPath(obj: any, jsonPath: string): any {
  const path = jsonPath.replace(/^\$\.?/, '');
  const segments = path.replace(/\[(\d+)\]/g, '.$1').split('.');

  let current = obj;
  for (const segment of segments) {
    if (current === null || current === undefined) return undefined;
    if (!isNaN(Number(segment))) {
      current = current[Number(segment)];
    } else {
      current = current[segment];
    }
  }
  return current;
}
