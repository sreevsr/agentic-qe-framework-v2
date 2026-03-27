#!/usr/bin/env node

/**
 * failure-classifier.js — Classifies test failures for CI/CD decision-making
 *
 * Tier 1 of three-tier failure handling. Deterministic — no LLM, no tokens.
 *
 * Usage:
 *   node scripts/failure-classifier.js --results=output/test-results/last-run-parsed.json
 *   node scripts/failure-classifier.js --results=<file> --output=analysis.json
 *
 * Classifications: AUTO_RETRY, SELECTOR_ISSUE, LIKELY_REGRESSION, ENVIRONMENT_ISSUE, NEEDS_TRIAGE
 */

const fs = require('fs');
const path = require('path');

const args = {};
process.argv.slice(2).forEach(arg => {
  const match = arg.match(/^--([\w-]+)=(.+)$/);
  if (match) args[match[1]] = match[2];
});

const resultsFile = args.results;
const outputFile = args.output || path.join(path.dirname(resultsFile || '.'), 'failure-analysis.json');

if (!resultsFile || !fs.existsSync(resultsFile)) {
  console.error('Usage: node scripts/failure-classifier.js --results=<parsed-results.json>');
  process.exit(1);
}

const results = JSON.parse(fs.readFileSync(resultsFile, 'utf-8'));

const historyFile = path.join(path.dirname(resultsFile), 'test-stability-history.json');
let stabilityHistory = {};
if (fs.existsSync(historyFile)) {
  stabilityHistory = JSON.parse(fs.readFileSync(historyFile, 'utf-8'));
}

function categorizeError(errorMsg) {
  const msg = errorMsg.toLowerCase();
  if (msg.includes('waiting for locator') || msg.includes('element not found')) return 'ELEMENT_NOT_FOUND';
  if (msg.includes('timeout') || msg.includes('timed out')) return 'TIMEOUT';
  if (msg.includes('expect(') || msg.includes('expected') || msg.includes('tobe(')) return 'ASSERTION_FAILURE';
  if (msg.includes('navigation') || msg.includes('net::err') || msg.includes('page.goto')) return 'NAVIGATION_ERROR';
  if (msg.includes('econnrefused') || msg.includes('enotfound')) return 'NETWORK_ERROR';
  if (msg.includes('syntaxerror') || msg.includes('typeerror')) return 'CODE_ERROR';
  return 'UNKNOWN';
}

function classifyFailure(failure) {
  const testId = failure.testName || failure.title || 'unknown';
  const errorMsg = failure.error || failure.errorMessage || '';
  const errorType = categorizeError(errorMsg);

  const history = stabilityHistory[testId];
  if (history) {
    const stabilityIndex = history.passes / (history.passes + history.failures);
    if (stabilityIndex > 0.95 && !failure.retriedAndFailed) {
      return { testId, action: 'AUTO_RETRY', confidence: 'high', reason: `Stability ${(stabilityIndex * 100).toFixed(1)}%`, errorType, errorMessage: errorMsg.substring(0, 200) };
    }
  }

  if (errorType === 'ELEMENT_NOT_FOUND' || errorType === 'TIMEOUT') {
    return { testId, action: 'SELECTOR_ISSUE', confidence: 'medium', reason: 'Element not found or timeout', errorType, errorMessage: errorMsg.substring(0, 200) };
  }
  if (errorType === 'ASSERTION_FAILURE') {
    return { testId, action: 'LIKELY_REGRESSION', confidence: 'medium', reason: 'Assertion failed', errorType, errorMessage: errorMsg.substring(0, 200) };
  }
  if (errorType === 'NAVIGATION_ERROR' || errorType === 'NETWORK_ERROR') {
    return { testId, action: 'ENVIRONMENT_ISSUE', confidence: 'medium', reason: 'Navigation/network error', errorType, errorMessage: errorMsg.substring(0, 200) };
  }

  return { testId, action: 'NEEDS_TRIAGE', confidence: 'low', reason: 'Cannot classify', errorType, errorMessage: errorMsg.substring(0, 200) };
}

const failures = (results.failures || results.failed || []).map(classifyFailure);

const summary = {
  timestamp: new Date().toISOString(),
  totalFailures: failures.length,
  classifications: {
    AUTO_RETRY: failures.filter(f => f.action === 'AUTO_RETRY').length,
    SELECTOR_ISSUE: failures.filter(f => f.action === 'SELECTOR_ISSUE').length,
    LIKELY_REGRESSION: failures.filter(f => f.action === 'LIKELY_REGRESSION').length,
    ENVIRONMENT_ISSUE: failures.filter(f => f.action === 'ENVIRONMENT_ISSUE').length,
    NEEDS_TRIAGE: failures.filter(f => f.action === 'NEEDS_TRIAGE').length,
  },
  failures,
};

fs.writeFileSync(outputFile, JSON.stringify(summary, null, 2));
console.log(`\nFailure Classification: ${summary.totalFailures} failures`);
Object.entries(summary.classifications).forEach(([k, v]) => console.log(`  ${k}: ${v}`));
console.log(`Output: ${outputFile}`);
