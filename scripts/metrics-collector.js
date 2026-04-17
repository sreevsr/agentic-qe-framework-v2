#!/usr/bin/env node

/**
 * metrics-collector.js — Aggregates agent and test run metrics
 * Layer 1 of the observability system.
 *
 * Usage:
 *   node scripts/metrics-collector.js --run-type=pipeline
 *   node scripts/metrics-collector.js --run-type=nightly
 *   node scripts/metrics-collector.js --run-type=pipeline --scenario=saucedemo-login
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const args = {};
process.argv.slice(2).forEach(arg => {
  const match = arg.match(/^--([\w-]+)=(.+)$/);
  if (match) args[match[1]] = match[2];
});

const runType = args['run-type'] || 'pipeline';
const scenarioFilter = args.scenario || null;
const metricsDir = path.join(ROOT, 'output', 'reports', 'metrics');
const resultsFile = path.join(ROOT, 'output', 'test-results', 'results.json');

if (!fs.existsSync(metricsDir)) fs.mkdirSync(metricsDir, { recursive: true });

// Collect test execution metrics from Playwright JSON results
let testMetrics = { total: 0, passed: 0, failed: 0, skipped: 0, duration: 0 };
if (fs.existsSync(resultsFile)) {
  try {
    const results = JSON.parse(fs.readFileSync(resultsFile, 'utf-8'));
    if (results.suites) {
      const allTests = flattenTests(results.suites);
      testMetrics.total = allTests.length;
      testMetrics.passed = allTests.filter(t => t.status === 'passed' || t.ok === true).length;
      testMetrics.failed = allTests.filter(t => t.status === 'failed' || t.ok === false).length;
      testMetrics.skipped = allTests.filter(t => t.status === 'skipped').length;
    }
    if (results.stats) testMetrics.duration = results.stats.duration || 0;
  } catch (err) { console.warn('Warning: Could not parse test results:', err.message); }
}

// Collect agent metrics files
const agentMetrics = [];
if (fs.existsSync(metricsDir)) {
  fs.readdirSync(metricsDir)
    .filter(f => f.match(/^(enrichment|explorer|builder|executor|reviewer|healer|orchestrator)-metrics-/))
    .filter(f => !scenarioFilter || f.includes(scenarioFilter))
    .forEach(f => {
      try { agentMetrics.push(JSON.parse(fs.readFileSync(path.join(metricsDir, f), 'utf-8'))); }
      catch (err) { console.warn(`Warning: Could not read ${f}:`, err.message); }
    });
}

// Aggregate
const pipeline = {
  timestamp: new Date().toISOString(),
  runType,
  scenarioFilter: scenarioFilter || 'all',
  testExecution: testMetrics,
  agents: agentMetrics,
  summary: {
    firstRunPassRate: testMetrics.total > 0
      ? ((testMetrics.passed / testMetrics.total) * 100).toFixed(1) + '%'
      : 'N/A',
    totalDurationMs: testMetrics.duration,
    agentCount: agentMetrics.length,
  },
};

const outputFile = path.join(metricsDir, `pipeline-metrics-${Date.now()}.json`);
fs.writeFileSync(outputFile, JSON.stringify(pipeline, null, 2));
console.log(`Metrics collected: ${outputFile}`);
console.log(`  Tests: ${testMetrics.passed}/${testMetrics.total} passed (${pipeline.summary.firstRunPassRate})`);
console.log(`  Failed: ${testMetrics.failed} | Skipped: ${testMetrics.skipped}`);
console.log(`  Duration: ${testMetrics.duration}ms`);
console.log(`  Agent metrics: ${agentMetrics.length} files`);

/**
 * Flatten nested Playwright suite structure into individual test results.
 * Handles specs with multiple test results (from retries, parameterization).
 */
function flattenTests(suites) {
  const tests = [];
  for (const suite of suites) {
    if (suite.specs) {
      for (const spec of suite.specs) {
        if (spec.tests) {
          for (const test of spec.tests) {
            // Each test has results array (retries)
            const lastResult = test.results?.[test.results.length - 1];
            tests.push({
              title: spec.title,
              status: lastResult?.status || (spec.ok ? 'passed' : 'failed'),
              ok: spec.ok,
              duration: lastResult?.duration || 0,
            });
          }
        } else {
          tests.push({ title: spec.title, status: spec.ok ? 'passed' : 'failed', ok: spec.ok });
        }
      }
    }
    if (suite.suites) tests.push(...flattenTests(suite.suites));
  }
  return tests;
}
