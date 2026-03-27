#!/usr/bin/env node

/**
 * metrics-collector.js — Aggregates agent and test run metrics
 * Layer 1 of the observability system.
 *
 * Usage: node scripts/metrics-collector.js --run-type=pipeline
 */

const fs = require('fs');
const path = require('path');

const args = {};
process.argv.slice(2).forEach(arg => {
  const match = arg.match(/^--([\w-]+)=(.+)$/);
  if (match) args[match[1]] = match[2];
});

const runType = args['run-type'] || 'pipeline';
const metricsDir = path.join('output', 'reports', 'metrics');
const resultsFile = path.join('output', 'test-results', 'results.json');

if (!fs.existsSync(metricsDir)) fs.mkdirSync(metricsDir, { recursive: true });

let testMetrics = { total: 0, passed: 0, failed: 0, skipped: 0, duration: 0 };
if (fs.existsSync(resultsFile)) {
  try {
    const results = JSON.parse(fs.readFileSync(resultsFile, 'utf-8'));
    if (results.suites) {
      const specs = flattenSpecs(results.suites);
      testMetrics.total = specs.length;
      testMetrics.passed = specs.filter(s => s.ok).length;
      testMetrics.failed = specs.filter(s => !s.ok).length;
    }
    if (results.stats) testMetrics.duration = results.stats.duration || 0;
  } catch (err) { console.warn('Could not parse results:', err.message); }
}

const agentMetrics = [];
if (fs.existsSync(metricsDir)) {
  fs.readdirSync(metricsDir)
    .filter(f => f.match(/^(explorer|executor|enrichment|reviewer)-metrics-/))
    .forEach(f => {
      try { agentMetrics.push(JSON.parse(fs.readFileSync(path.join(metricsDir, f), 'utf-8'))); }
      catch (err) { console.warn(`Could not read ${f}`); }
    });
}

const pipeline = {
  timestamp: new Date().toISOString(), runType, testExecution: testMetrics, agents: agentMetrics,
  summary: {
    firstRunPassRate: testMetrics.total > 0 ? ((testMetrics.passed / testMetrics.total) * 100).toFixed(1) + '%' : 'N/A',
    totalDurationMs: testMetrics.duration, agentCount: agentMetrics.length,
  },
};

const outputFile = path.join(metricsDir, `pipeline-metrics-${Date.now()}.json`);
fs.writeFileSync(outputFile, JSON.stringify(pipeline, null, 2));
console.log(`Metrics: ${testMetrics.passed}/${testMetrics.total} passed (${pipeline.summary.firstRunPassRate})`);

function flattenSpecs(suites) {
  const specs = [];
  for (const s of suites) {
    if (s.specs) specs.push(...s.specs);
    if (s.suites) specs.push(...flattenSpecs(s.suites));
  }
  return specs;
}
