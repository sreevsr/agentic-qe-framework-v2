#!/usr/bin/env node

/**
 * failure-classifier.js — Classifies test failures for CI/CD decision-making
 *
 * Tier 1 of three-tier failure handling. Deterministic — no LLM, no tokens.
 *
 * Usage:
 *   node scripts/failure-classifier.js --results=output/test-results/last-run-parsed.json
 *   node scripts/failure-classifier.js --results=<file> --output=analysis.json --scenario=<name>
 *
 * Classifications: AUTO_RETRY, SELECTOR_ISSUE, LIKELY_REGRESSION, ENVIRONMENT_ISSUE, CODE_ERROR, NEEDS_TRIAGE
 *
 * Exit codes:
 *   0 — No regressions found (only AUTO_RETRY, SELECTOR_ISSUE, or ENVIRONMENT_ISSUE)
 *   1 — Regressions or triage-needed failures found
 *   2 — Usage error (missing arguments, file not found)
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const args = {};
process.argv.slice(2).forEach(arg => {
  const match = arg.match(/^--([\w-]+)=(.+)$/);
  if (match) args[match[1]] = match[2];
});

const resultsFile = args.results;
const scenarioFilter = args.scenario || null;
const outputFile = args.output || path.join(path.dirname(resultsFile || '.'), 'failure-analysis.json');

if (!resultsFile || !fs.existsSync(resultsFile)) {
  console.error('Usage: node scripts/failure-classifier.js --results=<parsed-results.json> [--scenario=<name>] [--output=<path>]');
  process.exit(2);
}

const results = JSON.parse(fs.readFileSync(resultsFile, 'utf-8'));

// Stability history — tracks per-test pass/fail rates across runs
const historyFile = path.join(path.dirname(resultsFile), 'test-stability-history.json');
let stabilityHistory = {};
if (fs.existsSync(historyFile)) {
  stabilityHistory = JSON.parse(fs.readFileSync(historyFile, 'utf-8'));
}

/**
 * Categorize error message into failure types.
 *
 * Mobile categories (mapped to agents/core/executor.md Section 7 — Mobile Failure Signatures):
 *   GLIDE_TYPING_INJECTION       — keyboard visible during swipe; text grows in EditText
 *   MULTI_ELEMENT_TEXT_MATCH     — locator text spans two TextView elements
 *   COMPOSE_NO_ACCESSIBILITY_NODE — element rendered as Canvas, no a11y node
 *   WEBVIEW_VS_NATIVE_MISMATCH   — code switches to WEBVIEW context but screen is native
 *   UIAUTOMATOR_IDLE_TIMEOUT     — Appium waiting for app to be idle (RN apps)
 *   KEYBOARD_BLOCKING            — element not tappable because keyboard covers it
 *   STALE_NAVIGATION_STACK       — app in unexpected state, needs force-stop + relaunch
 */
function categorizeError(errorMsg) {
  const msg = errorMsg.toLowerCase();

  // Mobile-specific signatures (check first — they include patterns that overlap with web)
  if (msg.includes('waiting for app to be idle') || msg.includes('uiautomator') && msg.includes('idle')) return 'UIAUTOMATOR_IDLE_TIMEOUT';
  if (msg.includes('webview') || msg.includes('switchcontext')) return 'WEBVIEW_VS_NATIVE_MISMATCH';
  if (msg.includes('keyboard') && (msg.includes('covers') || msg.includes('blocking') || msg.includes('shown'))) return 'KEYBOARD_BLOCKING';
  if (msg.includes('activity') && msg.includes('not reached')) return 'STALE_NAVIGATION_STACK';
  if (msg.includes('could not be resolved') && msg.includes('tried:')) {
    // MobileLocatorLoader's "all strategies failed" error — could be multi-element or just stale.
    // Multi-element heuristic: extract the textContains("...") argument and check its length.
    // A TextView rarely renders >25 chars of plain text without wrapping; longer values mean
    // the locator is trying to match across multiple TextView elements.
    const textContainsMatch = errorMsg.match(/textContains\("([^"]+)"\)/i);
    if (textContainsMatch && textContainsMatch[1].length > 25) {
      return 'MULTI_ELEMENT_TEXT_MATCH';
    }
    return 'ELEMENT_NOT_FOUND';
  }
  if (msg.includes('no a11y node') || msg.includes('compose element')) return 'COMPOSE_NO_ACCESSIBILITY_NODE';
  if (msg.match(/by\s+by\s+by/i) || msg.includes('glide typing')) return 'GLIDE_TYPING_INJECTION';

  // Web/api signatures
  if (msg.includes('waiting for locator') || msg.includes('element not found') || msg.includes('no element matches')) return 'ELEMENT_NOT_FOUND';
  if (msg.includes('timeout') || msg.includes('exceeded') || msg.includes('timed out')) return 'TIMEOUT';
  if (msg.includes('expect(') || msg.includes('expected') || msg.includes('tobe(') || msg.includes('tocontain(') || msg.includes('tohaveurl')) return 'ASSERTION_FAILURE';
  if (msg.includes('navigation') || msg.includes('net::err') || msg.includes('page.goto')) return 'NAVIGATION_ERROR';
  if (msg.includes('econnrefused') || msg.includes('enotfound') || msg.includes('fetch failed')) return 'NETWORK_ERROR';
  if (msg.includes('syntaxerror') || msg.includes('typeerror') || msg.includes('referenceerror') || msg.includes('cannot find module')) return 'CODE_ERROR';
  return 'UNKNOWN';
}

/**
 * Classify a single test failure
 */
function classifyFailure(failure) {
  const testId = failure.testName || failure.title || 'unknown';
  // Support both shapes: legacy `failure.error: string` and the
  // test-results-parser.js shape `failure.error: { message, ... }`
  const rawError = failure.error;
  const errorMsg = (rawError && typeof rawError === 'object' && rawError.message)
    ? rawError.message
    : (typeof rawError === 'string' ? rawError : (failure.errorMessage || ''));
  const errorType = categorizeError(errorMsg);

  // 1. Stability check — known flaky?
  const history = stabilityHistory[testId];
  if (history && (history.passes + history.failures) > 0) {
    const stabilityIndex = history.passes / (history.passes + history.failures);
    if (stabilityIndex > 0.95 && !failure.retriedAndFailed) {
      return { testId, action: 'AUTO_RETRY', confidence: 'high', reason: `Stability ${(stabilityIndex * 100).toFixed(1)}%`, errorType, errorMessage: errorMsg.substring(0, 1000) };
    }
  }

  // 2. Code/import error — mechanical fix possible
  if (errorType === 'CODE_ERROR') {
    return { testId, action: 'CODE_ERROR', confidence: 'high', reason: 'Syntax, type, or import error — mechanical fix possible', errorType, errorMessage: errorMsg.substring(0, 1000) };
  }

  // 3. Selector/locator issue
  if (errorType === 'ELEMENT_NOT_FOUND' || errorType === 'TIMEOUT') {
    return { testId, action: 'SELECTOR_ISSUE', confidence: 'medium', reason: 'Element not found or timeout — likely stale selector', errorType, errorMessage: errorMsg.substring(0, 1000) };
  }

  // 3a. Mobile-specific signatures with deterministic fixes
  if (errorType === 'MULTI_ELEMENT_TEXT_MATCH') {
    return { testId, action: 'SELECTOR_ISSUE', confidence: 'high', reason: 'Mobile: locator text spans multiple TextView elements — split into two locators using a structural anchor', errorType, errorMessage: errorMsg.substring(0, 1000) };
  }
  if (errorType === 'COMPOSE_NO_ACCESSIBILITY_NODE') {
    return { testId, action: 'SELECTOR_ISSUE', confidence: 'high', reason: 'Mobile: Compose/Canvas element has no a11y node — switch to coordinate tap with FRAGILE comment', errorType, errorMessage: errorMsg.substring(0, 1000) };
  }
  if (errorType === 'WEBVIEW_VS_NATIVE_MISMATCH') {
    return { testId, action: 'CODE_ERROR', confidence: 'high', reason: 'Mobile: WebView context-switching code on a native screen — remove getContexts/switchContext and use native locators', errorType, errorMessage: errorMsg.substring(0, 1000) };
  }
  if (errorType === 'KEYBOARD_BLOCKING' || errorType === 'GLIDE_TYPING_INJECTION') {
    return { testId, action: 'CODE_ERROR', confidence: 'high', reason: 'Mobile: keyboard not dismissed before next interaction — use BaseScreen.typeText (auto-hides) or call hideKeyboard()', errorType, errorMessage: errorMsg.substring(0, 1000) };
  }
  if (errorType === 'UIAUTOMATOR_IDLE_TIMEOUT') {
    return { testId, action: 'ENVIRONMENT_ISSUE', confidence: 'high', reason: 'Mobile: UiAutomator2 waiting for app idle on a React Native app — apply waitForIdleTimeout: 0 in wdio.conf.ts before() hook', errorType, errorMessage: errorMsg.substring(0, 1000) };
  }
  if (errorType === 'STALE_NAVIGATION_STACK') {
    return { testId, action: 'AUTO_RETRY', confidence: 'medium', reason: 'Mobile: app in unexpected state — add force-stop + relaunch in before() hook', errorType, errorMessage: errorMsg.substring(0, 1000) };
  }

  // 4. Assertion failure — likely regression
  if (errorType === 'ASSERTION_FAILURE') {
    return { testId, action: 'LIKELY_REGRESSION', confidence: 'medium', reason: 'Assertion failed — expected value does not match actual', errorType, errorMessage: errorMsg.substring(0, 1000) };
  }

  // 5. Navigation/network — environment issue
  if (errorType === 'NAVIGATION_ERROR' || errorType === 'NETWORK_ERROR') {
    return { testId, action: 'ENVIRONMENT_ISSUE', confidence: 'medium', reason: 'Navigation or network error — possible environment issue', errorType, errorMessage: errorMsg.substring(0, 1000) };
  }

  // 6. Default — needs triage
  return { testId, action: 'NEEDS_TRIAGE', confidence: 'low', reason: 'Cannot classify confidently — needs human review', errorType, errorMessage: errorMsg.substring(0, 1000) };
}

// Get all failures, optionally filter by scenario
let allFailures = results.failures || results.failed || [];
if (scenarioFilter) {
  allFailures = allFailures.filter(f => {
    const id = f.testName || f.title || '';
    return id.toLowerCase().includes(scenarioFilter.toLowerCase());
  });
}

const failures = allFailures.map(classifyFailure);

// Build summary
const summary = {
  timestamp: new Date().toISOString(),
  scenarioFilter: scenarioFilter || 'all',
  totalFailures: failures.length,
  classifications: {
    AUTO_RETRY: failures.filter(f => f.action === 'AUTO_RETRY').length,
    SELECTOR_ISSUE: failures.filter(f => f.action === 'SELECTOR_ISSUE').length,
    LIKELY_REGRESSION: failures.filter(f => f.action === 'LIKELY_REGRESSION').length,
    ENVIRONMENT_ISSUE: failures.filter(f => f.action === 'ENVIRONMENT_ISSUE').length,
    CODE_ERROR: failures.filter(f => f.action === 'CODE_ERROR').length,
    NEEDS_TRIAGE: failures.filter(f => f.action === 'NEEDS_TRIAGE').length,
  },
  failures,
};

// Write output
const outputDir = path.dirname(outputFile);
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(outputFile, JSON.stringify(summary, null, 2));

// Update stability history with this run's results
const allTests = results.tests || results.specs || [];
for (const test of allTests) {
  const testId = test.testName || test.title || test.name;
  if (!testId) continue;
  if (!stabilityHistory[testId]) stabilityHistory[testId] = { passes: 0, failures: 0, lastSeen: null };
  if (test.ok || test.status === 'passed') {
    stabilityHistory[testId].passes++;
  } else if (test.status === 'failed' || test.ok === false) {
    stabilityHistory[testId].failures++;
  }
  stabilityHistory[testId].lastSeen = new Date().toISOString();
}
fs.writeFileSync(historyFile, JSON.stringify(stabilityHistory, null, 2));

// Console output
console.log(`\nFailure Classification${scenarioFilter ? ` (scenario: ${scenarioFilter})` : ''}:`);
console.log(`  Total failures:     ${summary.totalFailures}`);
Object.entries(summary.classifications).forEach(([k, v]) => {
  if (v > 0) console.log(`  ${k}: ${v}`);
});
console.log(`Output: ${outputFile}`);
console.log(`Stability history updated: ${historyFile}`);

// Exit code — nonzero if regressions or triage-needed failures found
const hasRegressions = summary.classifications.LIKELY_REGRESSION > 0 || summary.classifications.NEEDS_TRIAGE > 0;
process.exit(hasRegressions ? 1 : 0);
