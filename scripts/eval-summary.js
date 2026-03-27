#!/usr/bin/env node

/**
 * eval-summary.js — Agent evaluation summary (Layer 2 observability)
 * Usage: node scripts/eval-summary.js --scenario=<name>
 */

const fs = require('fs');
const path = require('path');

const args = {};
process.argv.slice(2).forEach(arg => {
  const match = arg.match(/^--([\w-]+)=(.+)$/);
  if (match) args[match[1]] = match[2];
});

const scenario = args.scenario;
if (!scenario) { console.error('Usage: node scripts/eval-summary.js --scenario=<name>'); process.exit(1); }

const metricsDir = path.join('output', 'reports', 'metrics');
const metricFiles = fs.existsSync(metricsDir)
  ? fs.readdirSync(metricsDir).filter(f => f.startsWith('pipeline-metrics-')).sort().reverse() : [];

let metrics = null;
if (metricFiles.length > 0) metrics = JSON.parse(fs.readFileSync(path.join(metricsDir, metricFiles[0]), 'utf-8'));

const scorecardFile = path.join('output', 'reports', `review-scorecard-${scenario}.md`);
let scorecardScore = 'N/A';
if (fs.existsSync(scorecardFile)) {
  const match = fs.readFileSync(scorecardFile, 'utf-8').match(/Overall Score:\s*(\d+)\/(\d+)/);
  if (match) scorecardScore = `${match[1]}/${match[2]}`;
}

const evalSummary = {
  timestamp: new Date().toISOString(), scenario,
  metrics: {
    firstRunPassRate: metrics?.summary?.firstRunPassRate || 'N/A',
    totalDuration: metrics?.summary?.totalDurationMs || 'N/A',
    testsPassed: metrics?.testExecution?.passed || 0,
    testsTotal: metrics?.testExecution?.total || 0,
  },
  qualityScore: scorecardScore,
};

const outputFile = path.join(metricsDir, `eval-summary-${scenario}.json`);
if (!fs.existsSync(metricsDir)) fs.mkdirSync(metricsDir, { recursive: true });
fs.writeFileSync(outputFile, JSON.stringify(evalSummary, null, 2));
console.log(`Eval: ${scenario} | Pass rate: ${evalSummary.metrics.firstRunPassRate} | Quality: ${scorecardScore}`);
