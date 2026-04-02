/**
 * mobile-step-handlers.ts — Step handlers for mobile (Appium) plan execution.
 *
 * Mirrors the web step-handlers.ts but uses Appium MCP tools:
 *   - tap (instead of click)
 *   - type_text (instead of fill)
 *   - page_source (instead of browser_snapshot)
 *   - swipe, scroll_to_element, long_press, back (mobile-specific)
 *
 * Element targeting uses strategy + value (not CSS/role):
 *   { strategy: "accessibility_id", value: "test-LOGIN", fallbacks: [...] }
 *
 * The Appium MCP server must be running (mcp-servers/appium/).
 * The Appium server itself must be running on APPIUM_HOST:APPIUM_PORT.
 */

import { VariableContext, setCapturedVariable, resolveDeep, resolveString } from './variable-resolver';
import * as fs from 'fs';
import * as path from 'path';

// --- Types ---

export interface MobileTarget {
  strategy: string;        // accessibility_id, id, xpath, uiautomator, class_chain, predicate_string
  value: string;
  fallbacks?: MobileTarget[];
}

export interface MobileStepResult {
  status: 'pass' | 'fail' | 'skip';
  duration: number;
  evidence?: string;
  error?: string;
  capturedValues?: Record<string, any>;
  screenshot?: string;
}

export interface MobileStep {
  id: number;
  section?: string;
  description: string;
  type: string;
  action: any;
  onFailure?: 'continue' | 'stop' | 'heal';
  _fingerprint?: any;
}

export interface MobileHandlerContext {
  /** Function to call an Appium MCP tool. Injected by the mobile replay engine. */
  callMcp: (tool: string, params: Record<string, any>) => Promise<any>;
  variables: VariableContext;
  config: MobileReplayConfig;
  screenshotDir: string;
}

export interface MobileReplayConfig {
  timeouts: {
    action: number;      // default 15000 (mobile is slower)
    launch: number;      // default 60000
    test: number;        // default 300000
  };
  screenshotOnFailure: boolean;
  pacing: {
    globalDelayMs: number;
    postActionWait: number;  // ms to wait after each action (default 500 for animations)
  };
}

// --- Handler Registry ---

type MobileStepHandler = (step: MobileStep, ctx: MobileHandlerContext) => Promise<MobileStepResult>;

export const mobileHandlers: Record<string, MobileStepHandler> = {
  LAUNCH_APP:    handleLaunchApp,
  CLOSE_APP:     handleCloseApp,
  ACTION:        handleAction,
  VERIFY:        handleVerify,
  VERIFY_SOFT:   handleVerifySoft,
  CAPTURE:       handleCapture,
  SCREENSHOT:    handleScreenshot,
  REPORT:        handleReport,
  WAIT:          handleWait,
  API_CALL:      handleApiCall,
  NAVIGATE:      handleNavigate,
  CALCULATE:     handleCalculate,
  FOR_EACH:      handleForEach,
  CONDITIONAL:   handleConditional,
  DB_QUERY:      handleDbQuery,
  WRITE_DATA:    handleWriteData,
  SKILL:         handleSkill,
};

// Wrap all handlers with error handling + screenshot on failure
for (const [type, handler] of Object.entries(mobileHandlers)) {
  mobileHandlers[type] = wrapHandler(handler);
}

function wrapHandler(handler: MobileStepHandler): MobileStepHandler {
  return async (step: MobileStep, ctx: MobileHandlerContext): Promise<MobileStepResult> => {
    const start = Date.now();
    try {
      const result = await handler(step, ctx);
      result.duration = Date.now() - start;
      return result;
    } catch (error: any) {
      const duration = Date.now() - start;
      let screenshot: string | undefined;
      if (ctx.config.screenshotOnFailure) {
        screenshot = await captureFailureScreenshot(ctx, step);
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

async function captureFailureScreenshot(ctx: MobileHandlerContext, step: MobileStep): Promise<string | undefined> {
  try {
    const filename = `failure-step-${step.id}.png`;
    const filepath = path.join(ctx.screenshotDir, filename);
    const result = await ctx.callMcp('screenshot', { save_path: filepath });
    return filepath;
  } catch {
    return undefined;
  }
}

// --- Element Resolution ---

/**
 * Resolve a mobile target by trying the primary strategy, then fallbacks.
 * Returns the strategy+value pair that successfully finds the element.
 */
async function resolveTarget(
  ctx: MobileHandlerContext,
  target: MobileTarget,
  timeout: number,
): Promise<{ strategy: string; value: string; description: string }> {
  // Try primary
  const isVisible = await ctx.callMcp('is_displayed', {
    strategy: target.strategy,
    value: target.value,
  }).catch(() => ({ visible: false }));

  if (isVisible?.visible) {
    return { strategy: target.strategy, value: target.value, description: `${target.strategy}="${target.value}"` };
  }

  // Wait for element with timeout
  try {
    await ctx.callMcp('wait_for_element', {
      strategy: target.strategy,
      value: target.value,
      state: 'displayed',
      timeout,
    });
    return { strategy: target.strategy, value: target.value, description: `${target.strategy}="${target.value}" (waited)` };
  } catch {
    // Primary failed, try fallbacks
  }

  // Try fallbacks
  if (target.fallbacks) {
    for (let i = 0; i < target.fallbacks.length; i++) {
      const fb = target.fallbacks[i];
      try {
        const fbVisible = await ctx.callMcp('is_displayed', {
          strategy: fb.strategy,
          value: fb.value,
        }).catch(() => ({ visible: false }));

        if (fbVisible?.visible) {
          return { strategy: fb.strategy, value: fb.value, description: `fallback[${i}]: ${fb.strategy}="${fb.value}"` };
        }

        await ctx.callMcp('wait_for_element', {
          strategy: fb.strategy,
          value: fb.value,
          state: 'displayed',
          timeout: Math.min(timeout, 3000),
        });
        return { strategy: fb.strategy, value: fb.value, description: `fallback[${i}]: ${fb.strategy}="${fb.value}" (waited)` };
      } catch {
        continue;
      }
    }
  }

  // Nothing found — return primary (will fail on interaction)
  return { strategy: target.strategy, value: target.value, description: `${target.strategy}="${target.value}" (not found)` };
}

// --- LAUNCH_APP ---

async function handleLaunchApp(step: MobileStep, ctx: MobileHandlerContext): Promise<MobileStepResult> {
  const { capabilities } = step.action;
  await ctx.callMcp('launch_app', { capabilities: capabilities || {} });
  return { status: 'pass', duration: 0, evidence: `App launched` };
}

// --- CLOSE_APP ---

async function handleCloseApp(step: MobileStep, ctx: MobileHandlerContext): Promise<MobileStepResult> {
  await ctx.callMcp('close_app', {});
  return { status: 'pass', duration: 0, evidence: 'App closed' };
}

// --- NAVIGATE (deep link) ---

async function handleNavigate(step: MobileStep, ctx: MobileHandlerContext): Promise<MobileStepResult> {
  const { url, activity } = step.action;
  if (activity) {
    // Android activity-based navigation
    await ctx.callMcp('launch_app', {
      capabilities: { 'appium:appActivity': activity },
    }).catch(() => {});
    return { status: 'pass', duration: 0, evidence: `Navigated to activity: ${activity}` };
  }
  if (url) {
    // Deep link URI — open via device
    // Most Appium drivers support openUrl or mobile:deepLink
    try {
      await ctx.callMcp('launch_app', { deepLink: url });
    } catch {
      // Fallback: try press_key with URL if deep link not supported
      console.log(`  [Mobile] Deep link not directly supported, skipping: ${url}`);
    }
    return { status: 'pass', duration: 0, evidence: `Navigated to: ${url}` };
  }
  return { status: 'pass', duration: 0, evidence: 'Navigate: no URL or activity specified' };
}

// --- ACTION ---

async function handleAction(step: MobileStep, ctx: MobileHandlerContext): Promise<MobileStepResult> {
  const { verb } = step.action;
  const timeout = ctx.config.timeouts.action;

  switch (verb) {
    case 'tap':
    case 'click': {
      const target = step.action.target;
      const resolved = await resolveTarget(ctx, target, timeout);
      await ctx.callMcp('tap', { strategy: resolved.strategy, value: resolved.value });
      await postActionWait(ctx);
      return { status: 'pass', duration: 0, evidence: `Tapped: ${resolved.description}` };
    }

    case 'fill':
    case 'type': {
      const target = step.action.target;
      const resolved = await resolveTarget(ctx, target, timeout);
      await ctx.callMcp('type_text', {
        strategy: resolved.strategy,
        value: resolved.value,
        text: step.action.value,
      });
      return { status: 'pass', duration: 0, evidence: `Typed "${step.action.value}" into ${resolved.description}` };
    }

    case 'swipe': {
      const { direction, startX, startY, endX, endY } = step.action;
      if (direction) {
        await ctx.callMcp('swipe', { direction });
      } else {
        await ctx.callMcp('swipe', { startX, startY, endX, endY });
      }
      await postActionWait(ctx);
      return { status: 'pass', duration: 0, evidence: `Swiped ${direction || `(${startX},${startY})→(${endX},${endY})`}` };
    }

    case 'scroll_to': {
      const target = step.action.target;
      await ctx.callMcp('scroll_to_element', {
        strategy: target.strategy,
        value: target.value,
      });
      return { status: 'pass', duration: 0, evidence: `Scrolled to ${target.strategy}="${target.value}"` };
    }

    case 'long_press': {
      const target = step.action.target;
      const resolved = await resolveTarget(ctx, target, timeout);
      await ctx.callMcp('long_press', {
        strategy: resolved.strategy,
        value: resolved.value,
        duration: step.action.duration || 1000,
      });
      await postActionWait(ctx);
      return { status: 'pass', duration: 0, evidence: `Long pressed: ${resolved.description}` };
    }

    case 'back': {
      await ctx.callMcp('back', {});
      await postActionWait(ctx);
      return { status: 'pass', duration: 0, evidence: 'Pressed back' };
    }

    case 'press_key': {
      await ctx.callMcp('press_key', { key: step.action.key });
      return { status: 'pass', duration: 0, evidence: `Pressed key: ${step.action.key}` };
    }

    default:
      return { status: 'fail', duration: 0, error: `Unknown mobile action verb: ${verb}` };
  }
}

// --- VERIFY ---

async function handleVerify(step: MobileStep, ctx: MobileHandlerContext): Promise<MobileStepResult> {
  return executeAssertion(step, ctx, false);
}

// --- VERIFY_SOFT ---

async function handleVerifySoft(step: MobileStep, ctx: MobileHandlerContext): Promise<MobileStepResult> {
  return executeAssertion(step, ctx, true);
}

async function executeAssertion(step: MobileStep, ctx: MobileHandlerContext, soft: boolean): Promise<MobileStepResult> {
  const { assertion } = step.action;
  const timeout = ctx.config.timeouts.action;

  try {
    switch (assertion) {
      case 'elementVisible': {
        const target = step.action.target;
        await ctx.callMcp('wait_for_element', {
          strategy: target.strategy,
          value: target.value,
          state: 'displayed',
          timeout,
        });
        return { status: 'pass', duration: 0, evidence: `${target.strategy}="${target.value}" is visible` };
      }

      case 'elementHidden': {
        const target = step.action.target;
        await ctx.callMcp('wait_for_element', {
          strategy: target.strategy,
          value: target.value,
          state: 'hidden',
          timeout,
        });
        return { status: 'pass', duration: 0, evidence: `${target.strategy}="${target.value}" is hidden` };
      }

      case 'textVisible': {
        const expected = step.action.expected;
        // Check page source for text presence
        const source = await ctx.callMcp('page_source', {});
        const pageText = source?.source || source || '';
        if (typeof pageText === 'string' && pageText.includes(expected)) {
          return { status: 'pass', duration: 0, evidence: `Text "${expected}" found in page source` };
        }
        throw new Error(`Text "${expected}" not found in page source`);
      }

      case 'textEquals': {
        const target = step.action.target;
        const resolved = await resolveTarget(ctx, target, timeout);
        const result = await ctx.callMcp('get_text', {
          strategy: resolved.strategy,
          value: resolved.value,
        });
        const actual = result?.text || '';
        if (actual !== step.action.expected) {
          throw new Error(`Expected "${step.action.expected}" but got "${actual}"`);
        }
        return { status: 'pass', duration: 0, evidence: `${resolved.description} text equals "${step.action.expected}"` };
      }

      case 'textContains': {
        const target = step.action.target;
        const resolved = await resolveTarget(ctx, target, timeout);
        const result = await ctx.callMcp('get_text', {
          strategy: resolved.strategy,
          value: resolved.value,
        });
        const actual = result?.text || '';
        if (!actual.includes(step.action.expected)) {
          throw new Error(`Expected "${actual}" to contain "${step.action.expected}"`);
        }
        return { status: 'pass', duration: 0, evidence: `${resolved.description} contains "${step.action.expected}"` };
      }

      case 'attributeEquals': {
        const target = step.action.target;
        const resolved = await resolveTarget(ctx, target, timeout);
        const result = await ctx.callMcp('get_attribute', {
          strategy: resolved.strategy,
          value: resolved.value,
          attribute: step.action.attribute,
        });
        const actual = result?.value || '';
        if (actual !== step.action.expected) {
          throw new Error(`Attribute "${step.action.attribute}" expected "${step.action.expected}" but got "${actual}"`);
        }
        return { status: 'pass', duration: 0, evidence: `${resolved.description}[${step.action.attribute}] equals "${step.action.expected}"` };
      }

      case 'valueEquals': {
        const actual = ctx.variables[step.action.variable] || '';
        if (String(actual) !== String(step.action.expected)) {
          throw new Error(`Expected "${step.action.expected}" but got "${actual}"`);
        }
        return { status: 'pass', duration: 0, evidence: `{{${step.action.variable}}} = "${actual}" equals "${step.action.expected}"` };
      }

      default:
        return { status: 'fail', duration: 0, error: `Unknown mobile assertion type: ${assertion}` };
    }
  } catch (error: any) {
    if (soft) {
      let screenshot: string | undefined;
      if (ctx.config.screenshotOnFailure) {
        screenshot = await captureFailureScreenshot(ctx, step);
      }
      return { status: 'fail', duration: 0, error: error.message, screenshot };
    }
    throw error;
  }
}

// --- CAPTURE ---

async function handleCapture(step: MobileStep, ctx: MobileHandlerContext): Promise<MobileStepResult> {
  const { target, extract, captureAs } = step.action;
  const timeout = ctx.config.timeouts.action;
  const resolved = await resolveTarget(ctx, target, timeout);

  let value: string;
  switch (extract) {
    case 'textContent':
    case 'text': {
      const result = await ctx.callMcp('get_text', {
        strategy: resolved.strategy,
        value: resolved.value,
      });
      value = result?.text || '';
      break;
    }
    case 'attribute': {
      const result = await ctx.callMcp('get_attribute', {
        strategy: resolved.strategy,
        value: resolved.value,
        attribute: step.action.attribute || 'content-desc',
      });
      value = result?.value || '';
      break;
    }
    default: {
      const result = await ctx.callMcp('get_text', {
        strategy: resolved.strategy,
        value: resolved.value,
      });
      value = result?.text || '';
      break;
    }
  }

  setCapturedVariable(ctx.variables, captureAs, value);
  return {
    status: 'pass',
    duration: 0,
    evidence: `Captured ${captureAs} = "${value}" via ${resolved.description}`,
    capturedValues: { [captureAs]: value },
  };
}

// --- SCREENSHOT ---

async function handleScreenshot(step: MobileStep, ctx: MobileHandlerContext): Promise<MobileStepResult> {
  const { name } = step.action;
  const filename = `${name}.png`;
  const filepath = path.join(ctx.screenshotDir, filename);
  fs.mkdirSync(path.dirname(filepath), { recursive: true });

  await ctx.callMcp('screenshot', { save_path: filepath });
  return {
    status: 'pass',
    duration: 0,
    evidence: `Screenshot saved: ${filepath}`,
    screenshot: filepath,
  };
}

// --- REPORT ---

async function handleReport(step: MobileStep, ctx: MobileHandlerContext): Promise<MobileStepResult> {
  return { status: 'pass', duration: 0, evidence: `REPORT: ${step.action.message}` };
}

// --- WAIT ---

async function handleWait(step: MobileStep, ctx: MobileHandlerContext): Promise<MobileStepResult> {
  const { condition, timeout, target, duration } = step.action;

  switch (condition) {
    case 'elementVisible': {
      await ctx.callMcp('wait_for_element', {
        strategy: target.strategy,
        value: target.value,
        state: 'displayed',
        timeout: timeout || 10000,
      });
      return { status: 'pass', duration: 0, evidence: `${target.strategy}="${target.value}" became visible` };
    }

    case 'elementHidden': {
      await ctx.callMcp('wait_for_element', {
        strategy: target.strategy,
        value: target.value,
        state: 'hidden',
        timeout: timeout || 10000,
      });
      return { status: 'pass', duration: 0, evidence: `${target.strategy}="${target.value}" became hidden` };
    }

    case 'elementExists': {
      await ctx.callMcp('wait_for_element', {
        strategy: target.strategy,
        value: target.value,
        state: 'exist',
        timeout: timeout || 10000,
      });
      return { status: 'pass', duration: 0, evidence: `${target.strategy}="${target.value}" exists in hierarchy` };
    }

    case 'delay': {
      await new Promise(resolve => setTimeout(resolve, duration || 1000));
      return { status: 'pass', duration: 0, evidence: `Waited ${duration || 1000}ms` };
    }

    default:
      return { status: 'fail', duration: 0, error: `Unknown mobile wait condition: ${condition}` };
  }
}

// --- API_CALL (platform-independent — uses native fetch) ---

async function handleApiCall(step: MobileStep, ctx: MobileHandlerContext): Promise<MobileStepResult> {
  const { method, url, headers, body, captureAs, captureFields, expectedStatus, auth } = step.action;

  const requestHeaders: Record<string, string> = { 'Content-Type': 'application/json', ...(headers || {}) };
  if (auth?.bearer) requestHeaders['Authorization'] = `Bearer ${auth.bearer}`;
  if (auth?.basic) requestHeaders['Authorization'] = `Basic ${Buffer.from(`${auth.basic.username}:${auth.basic.password}`).toString('base64')}`;
  if (auth?.apiKey) {
    if (auth.apiKey.in === 'query') {
      // handled in URL below
    } else {
      requestHeaders[auth.apiKey.name || 'X-API-Key'] = auth.apiKey.value;
    }
  }

  let fullUrl = url;
  if (auth?.apiKey?.in === 'query') {
    fullUrl += (fullUrl.includes('?') ? '&' : '?') + `${auth.apiKey.name}=${auth.apiKey.value}`;
  }

  const fetchOptions: RequestInit = {
    method: method.toUpperCase(),
    headers: requestHeaders,
    body: body && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase())
      ? (typeof body === 'string' ? body : JSON.stringify(body))
      : undefined,
  };

  const apiStart = Date.now();
  const response = await fetch(fullUrl, fetchOptions);
  const apiDuration = Date.now() - apiStart;
  const status = response.status;

  let responseBody: any;
  try { responseBody = await response.json(); } catch { responseBody = await response.text().catch(() => ''); }

  if (expectedStatus && status !== expectedStatus) {
    return { status: 'fail', duration: apiDuration, error: `API ${method} ${fullUrl} → ${status}, expected ${expectedStatus}` };
  }

  const capturedValues: Record<string, any> = {};
  if (captureAs) { setCapturedVariable(ctx.variables, captureAs, responseBody); capturedValues[captureAs] = responseBody; }
  if (captureFields) {
    for (const [varName, jsonPath] of Object.entries(captureFields)) {
      const val = extractJsonPath(responseBody, jsonPath as string);
      setCapturedVariable(ctx.variables, varName, val);
      capturedValues[varName] = val;
    }
  }

  return { status: 'pass', duration: apiDuration, evidence: `API ${method} ${fullUrl} → ${status} (${apiDuration}ms)`, capturedValues };
}

function extractJsonPath(obj: any, jsonPath: string): any {
  const pathStr = jsonPath.replace(/^\$\.?/, '');
  const segments = pathStr.replace(/\[(\d+)\]/g, '.$1').split('.');
  let current = obj;
  for (const seg of segments) {
    if (current === null || current === undefined) return undefined;
    current = !isNaN(Number(seg)) ? current[Number(seg)] : current[seg];
  }
  return current;
}

// --- DB_QUERY (stub — same as web) ---

async function handleDbQuery(step: MobileStep, ctx: MobileHandlerContext): Promise<MobileStepResult> {
  return { status: 'fail', duration: 0, error: 'DB_QUERY is not yet implemented for mobile. Use API_CALL for data operations.' };
}

// --- WRITE_DATA (platform-independent) ---

async function handleWriteData(step: MobileStep, ctx: MobileHandlerContext): Promise<MobileStepResult> {
  const { format, file, data, mode } = step.action;
  const filepath = path.resolve(file);
  fs.mkdirSync(path.dirname(filepath), { recursive: true });

  if (format === 'json') {
    let existing: any = {};
    if (mode === 'append' && fs.existsSync(filepath)) {
      existing = JSON.parse(fs.readFileSync(filepath, 'utf-8'));
    }
    const merged = mode === 'append' ? (Array.isArray(existing) ? [...existing, data] : { ...existing, ...data }) : data;
    fs.writeFileSync(filepath, JSON.stringify(merged, null, 2));
    return { status: 'pass', duration: 0, evidence: `Wrote JSON to ${filepath}` };
  }

  return { status: 'fail', duration: 0, error: `Unsupported write format: ${format}` };
}

// --- SKILL (load from skills/replay/) ---

async function handleSkill(step: MobileStep, ctx: MobileHandlerContext): Promise<MobileStepResult> {
  const { skill, params, captureAs } = step.action;
  const skillName = skill.split('/')[0];
  const jsPath = path.resolve('skills', 'replay', `${skillName}.skill.js`);
  if (!fs.existsSync(jsPath)) {
    return { status: 'fail', duration: 0, error: `Skill not found: ${skill} (looked for ${jsPath})` };
  }
  try {
    const skillModule = require(jsPath);
    const actionName = skill.split('/')[1]?.replace(/-([a-z])/g, (_: string, c: string) => c.toUpperCase());
    if (!actionName || typeof skillModule[actionName] !== 'function') {
      return { status: 'fail', duration: 0, error: `Skill "${skill}" has no action "${actionName}"` };
    }
    // For mobile skills, pass callMcp instead of page
    const result = await skillModule[actionName](ctx.callMcp, params);
    if (captureAs && result !== undefined) setCapturedVariable(ctx.variables, captureAs, result);
    return { status: 'pass', duration: 0, evidence: `Skill ${skill} executed`, capturedValues: captureAs ? { [captureAs]: result } : undefined };
  } catch (error: any) {
    return { status: 'fail', duration: 0, error: `Skill ${skill} failed: ${error.message}` };
  }
}

// --- CALCULATE (reuse from web) ---

async function handleCalculate(step: MobileStep, ctx: MobileHandlerContext): Promise<MobileStepResult> {
  const { expression, captureAs, resultFormat } = step.action;
  const resolvedExpr = resolveString(expression, ctx.variables);

  const SAFE_ARITHMETIC = /^[\d\s+\-*/().,%]+$/;
  if (!SAFE_ARITHMETIC.test(resolvedExpr)) {
    throw new Error(`CALCULATE expression contains unsafe characters: "${resolvedExpr}"`);
  }

  const result = new Function(`return (${resolvedExpr})`)();
  let finalValue = String(result);
  if (resultFormat) {
    finalValue = resultFormat.replace('{value}', String(result)).replace('{result}', String(result));
  }

  setCapturedVariable(ctx.variables, captureAs, finalValue);
  return {
    status: 'pass',
    duration: 0,
    evidence: `Calculated ${captureAs} = ${finalValue}`,
    capturedValues: { [captureAs]: finalValue },
  };
}

// --- FOR_EACH ---

async function handleForEach(step: MobileStep, ctx: MobileHandlerContext): Promise<MobileStepResult> {
  const { collection, as, steps } = step.action;

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

  const results: MobileStepResult[] = [];
  for (let i = 0; i < items.length; i++) {
    setCapturedVariable(ctx.variables, as, items[i]);
    for (const subStep of steps) {
      try {
        const resolvedSubStep = resolveDeep(subStep, ctx.variables);
        const handler = mobileHandlers[resolvedSubStep.type];
        if (!handler) {
          results.push({ status: 'fail', duration: 0, error: `Unknown step type in FOR_EACH: ${resolvedSubStep.type}` });
          continue;
        }
        const result = await handler(resolvedSubStep, ctx);
        results.push(result);
        if (result.status === 'fail' && resolvedSubStep.onFailure === 'stop') {
          return { status: 'fail', duration: 0, error: `FOR_EACH stopped at item ${i}: ${result.error}` };
        }
      } catch (err: any) {
        results.push({ status: 'fail', duration: 0, error: `FOR_EACH item ${i} error: ${err.message}` });
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

async function handleConditional(step: MobileStep, ctx: MobileHandlerContext): Promise<MobileStepResult> {
  const { if: condition, then: thenSteps, else: elseSteps } = step.action;
  let conditionMet = false;

  if (condition.elementVisible) {
    const vis = await ctx.callMcp('is_displayed', {
      strategy: condition.elementVisible.strategy,
      value: condition.elementVisible.value,
    }).catch(() => ({ visible: false }));
    conditionMet = vis?.visible || false;
  } else if (condition.variableEquals) {
    conditionMet = String(ctx.variables[condition.variableEquals.variable]) === String(condition.variableEquals.value);
  }

  const stepsToRun = conditionMet ? (thenSteps || []) : (elseSteps || []);
  const branchName = conditionMet ? 'then' : 'else';

  const branchResults: MobileStepResult[] = [];
  for (const subStep of stepsToRun) {
    try {
      const resolvedSubStep = resolveDeep(subStep, ctx.variables);
      const handler = mobileHandlers[resolvedSubStep.type];
      if (handler) {
        const result = await handler(resolvedSubStep, ctx);
        branchResults.push(result);
        if (result.status === 'fail' && resolvedSubStep.onFailure === 'stop') {
          return { status: 'fail', duration: 0, error: `CONDITIONAL ${branchName} stopped: ${result.error}` };
        }
      }
    } catch (err: any) {
      branchResults.push({ status: 'fail', duration: 0, error: err.message });
    }
  }

  const failed = branchResults.filter(r => r.status === 'fail').length;
  return {
    status: failed > 0 ? 'fail' : 'pass',
    duration: 0,
    evidence: `CONDITIONAL: ${branchName} branch (${stepsToRun.length} steps, ${failed} failed)`,
  };
}

// --- Helpers ---

async function postActionWait(ctx: MobileHandlerContext): Promise<void> {
  if (ctx.config.pacing.postActionWait > 0) {
    await new Promise(resolve => setTimeout(resolve, ctx.config.pacing.postActionWait));
  }
}
