#!/usr/bin/env node

/**
 * eval-summary.js — Agent evaluation summary (Layer 2 observability)
 *
 * Usage:
 *   node scripts/eval-summary.js --scenario=<name>
 *   node scripts/eval-summary.js --scenario=<name> --folder=<folder>
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const args = {};
process.argv.slice(2).forEach(arg => {
  const match = arg.match(/^--([\w-]+)=(.+)$/);
  if (match) args[match[1]] = match[2];
});

const scenario = args.scenario;
const folder = args.folder || null;
if (!scenario) { console.error('Usage: node scripts/eval-summary.js --scenario=<name> [--folder=<folder>]'); process.exit(1); }

const metricsDir = path.join(ROOT, 'output', 'reports', 'metrics');
const reportsDir = folder
  ? path.join(ROOT, 'output', 'reports', folder)
  : path.join(ROOT, 'output', 'reports');

// Find latest pipeline metrics
const metricFiles = fs.existsSync(metricsDir)
  ? fs.readdirSync(metricsDir).filter(f => f.startsWith('pipeline-metrics-')).sort().reverse()
  : [];

let metrics = null;
if (metricFiles.length > 0) {
  metrics = JSON.parse(fs.readFileSync(path.join(metricsDir, metricFiles[0]), 'utf-8'));
}

// Find scorecard
const scorecardFile = path.join(reportsDir, `review-scorecard-${scenario}.md`);
let scorecardScore = 'N/A';
let verdict = 'N/A';
if (fs.existsSync(scorecardFile)) {
  const content = fs.readFileSync(scorecardFile, 'utf-8');
  const scoreMatch = content.match(/Overall Score:\s*(\d+)\/(\d+)/);
  if (scoreMatch) scorecardScore = `${scoreMatch[1]}/${scoreMatch[2]}`;
  const verdictMatch = content.match(/Verdict:\s*(APPROVED|NEEDS FIXES|TESTS FAILING)/i);
  if (verdictMatch) verdict = verdictMatch[1];
}

// Find explorer report for step stats
const explorerReportFile = path.join(reportsDir, `explorer-report-${scenario}.md`);
let explorerStats = {};
if (fs.existsSync(explorerReportFile)) {
  const content = fs.readFileSync(explorerReportFile, 'utf-8');
  const stepsMatch = content.match(/Steps explored:\s*(\d+)\/(\d+)/);
  if (stepsMatch) explorerStats = { explored: parseInt(stepsMatch[1]), total: parseInt(stepsMatch[2]) };
  const firstTryMatch = content.match(/Steps verified on first try:\s*(\d+)/);
  if (firstTryMatch) explorerStats.firstTry = parseInt(firstTryMatch[1]);
  const blockedMatch = content.match(/Steps blocked.*?:\s*(\d+)/);
  if (blockedMatch) explorerStats.blocked = parseInt(blockedMatch[1]);
}

// Find executor report for cycle count
const executorReportFile = path.join(reportsDir, `executor-report-${scenario}.md`);
let executorStats = {};
if (fs.existsSync(executorReportFile)) {
  const content = fs.readFileSync(executorReportFile, 'utf-8');
  const cycleMatch = content.match(/Total cycles:\s*(\d+)/);
  if (cycleMatch) executorStats.cycles = parseInt(cycleMatch[1]);
  const statusMatch = content.match(/Final status:\s*(PASSING|FAILING)/i);
  if (statusMatch) executorStats.status = statusMatch[1];
}

// Generate eval summary
const evalSummary = {
  timestamp: new Date().toISOString(),
  scenario,
  folder: folder || null,
  testExecution: {
    firstRunPassRate: metrics?.summary?.firstRunPassRate || 'N/A',
    totalDuration: metrics?.summary?.totalDurationMs || 'N/A',
    testsPassed: metrics?.testExecution?.passed || 0,
    testsFailed: metrics?.testExecution?.failed || 0,
    testsTotal: metrics?.testExecution?.total || 0,
  },
  exploration: explorerStats,
  execution: executorStats,
  qualityScore: scorecardScore,
  verdict,
  agentPerformance: (metrics?.agents || []).map(a => ({
    agent: a.agent,
    durationMs: a.durationMs || 'N/A',
    tokensUsed: a.tokensUsed || 'N/A',
    contextWindowPct: a.contextWindowPct || 'N/A',
  })),
};

if (!fs.existsSync(metricsDir)) fs.mkdirSync(metricsDir, { recursive: true });
const outputFile = path.join(metricsDir, `eval-summary-${scenario}.json`);
fs.writeFileSync(outputFile, JSON.stringify(evalSummary, null, 2));

console.log(`\nEval Summary: ${scenario}${folder ? ` (folder: ${folder})` : ''}`);
console.log(`  Pass rate:      ${evalSummary.testExecution.firstRunPassRate}`);
console.log(`  Tests:          ${evalSummary.testExecution.testsPassed}/${evalSummary.testExecution.testsTotal}`);
console.log(`  Quality score:  ${scorecardScore}`);
console.log(`  Verdict:        ${verdict}`);
if (explorerStats.explored) console.log(`  Steps explored: ${explorerStats.explored}/${explorerStats.total} (${explorerStats.firstTry || 0} first-try, ${explorerStats.blocked || 0} blocked)`);
if (executorStats.cycles) console.log(`  Executor cycles: ${executorStats.cycles} (${executorStats.status})`);
console.log(`  Output: ${outputFile}`);
