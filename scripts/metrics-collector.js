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

// ---------------------------------------------------------------------------
// Executor fix-category concentration — Layer 1 signal for generation-rule gaps
//
// Parses Executor reports' "Fixes Applied" / "Fixes Summary" tables and counts
// fixes by Category column. If one category dominates (>= 40% of total fixes),
// it is a strong signal that a Builder or Explorer generation rule is
// under-specified — the framework is making Executor re-discover the same
// fix pattern scenario by scenario. Emitting this at the pipeline-metrics
// level gives the user an early warning without changing any runtime behavior.
// ---------------------------------------------------------------------------
const reportsDir = path.join(ROOT, 'output', 'reports');
const fixCategoryStats = collectExecutorFixCategories(reportsDir, scenarioFilter);

// Aggregate
const pipeline = {
  timestamp: new Date().toISOString(),
  runType,
  scenarioFilter: scenarioFilter || 'all',
  testExecution: testMetrics,
  agents: agentMetrics,
  executorFixCategories: fixCategoryStats,
  summary: {
    firstRunPassRate: testMetrics.total > 0
      ? ((testMetrics.passed / testMetrics.total) * 100).toFixed(1) + '%'
      : 'N/A',
    totalDurationMs: testMetrics.duration,
    agentCount: agentMetrics.length,
    fixCategoryConcentration: fixCategoryStats.concentrationWarning || null,
  },
};

const outputFile = path.join(metricsDir, `pipeline-metrics-${Date.now()}.json`);
fs.writeFileSync(outputFile, JSON.stringify(pipeline, null, 2));
console.log(`Metrics collected: ${outputFile}`);
console.log(`  Tests: ${testMetrics.passed}/${testMetrics.total} passed (${pipeline.summary.firstRunPassRate})`);
console.log(`  Failed: ${testMetrics.failed} | Skipped: ${testMetrics.skipped}`);
console.log(`  Duration: ${testMetrics.duration}ms`);
console.log(`  Agent metrics: ${agentMetrics.length} files`);
if (fixCategoryStats.totalFixes > 0) {
  console.log(`  Executor fixes: ${fixCategoryStats.totalFixes} across ${fixCategoryStats.reportsScanned} report(s)`);
  const topEntries = Object.entries(fixCategoryStats.byCategory).sort((a, b) => b[1] - a[1]).slice(0, 3);
  topEntries.forEach(([cat, n]) => {
    const pct = ((n / fixCategoryStats.totalFixes) * 100).toFixed(0);
    console.log(`    - ${cat}: ${n} (${pct}%)`);
  });
  if (fixCategoryStats.concentrationWarning) {
    console.log(`  \u26A0  CONCENTRATION ALERT: ${fixCategoryStats.concentrationWarning}`);
  }
}

/**
 * Collect executor fix-category statistics from executor-report-*.md files.
 *
 * The Executor writes a "Fixes Applied" table per cycle and a consolidated
 * "Fixes Summary" table at the end, with a Category column. We parse the
 * Category column (e.g., "Pacing", "Locator fix", "Config fix", "Test data fix")
 * and count occurrences.
 *
 * A single category exceeding 40% of total fixes is a strong signal that a
 * Builder/Explorer generation rule is under-specified — the framework is
 * forcing Executor to re-discover the same class of fix every scenario.
 *
 * Returns: { reportsScanned, totalFixes, byCategory, concentrationWarning }.
 * Silent on failure — this is a non-blocking observability signal.
 */
function collectExecutorFixCategories(reportsDir, scenarioFilter) {
  const result = { reportsScanned: 0, totalFixes: 0, byCategory: {}, concentrationWarning: null };
  if (!fs.existsSync(reportsDir)) return result;

  // Walk reportsDir and any one-level-deep folder (for folder-scoped scenarios)
  const candidates = [];
  const walk = dir => {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/^executor-report-.+\.md$/.test(entry.name)) {
        if (!scenarioFilter || entry.name.includes(scenarioFilter)) candidates.push(full);
      }
    }
  };
  walk(reportsDir);

  const categoryCounts = {};
  for (const fp of candidates) {
    let content;
    try { content = fs.readFileSync(fp, 'utf-8'); } catch { continue; }
    result.reportsScanned++;

    // Match lines of the form: | N | file/path | change | Category | Reason |
    // Category column is the 5th pipe-delimited column. Accept tables whose
    // header includes a "Category" column.
    const lines = content.split('\n');
    let inFixTable = false;
    let categoryColIdx = -1;
    for (const line of lines) {
      const trimmed = line.trim();
      // Detect a markdown table header containing a Category column
      if (/^\|\s*#\s*\|/.test(trimmed) && /\|\s*Category\s*\|/i.test(trimmed)) {
        const cols = trimmed.split('|').map(s => s.trim());
        categoryColIdx = cols.findIndex(c => c.toLowerCase() === 'category');
        inFixTable = categoryColIdx > -1;
        continue;
      }
      // End of table: blank line or a new header
      if (inFixTable && (trimmed === '' || /^#{1,6}\s/.test(trimmed))) {
        inFixTable = false;
        categoryColIdx = -1;
        continue;
      }
      if (inFixTable && /^\|/.test(trimmed) && !/^[-:|\s]+$/.test(trimmed.replace(/\|/g, ''))) {
        const cols = trimmed.split('|').map(s => s.trim());
        const cat = cols[categoryColIdx];
        if (!cat) continue;
        // Skip the markdown table separator row
        if (/^[-:]+$/.test(cat)) continue;
        // Normalize: "Pacing" / "pacing" / "Pacing + Locator" — split combined categories
        cat.split(/\s*[+/&,]\s*/).forEach(part => {
          const key = part.toLowerCase().replace(/\s+/g, ' ').replace(/\s*fix\s*$/i, '').trim();
          if (!key) return;
          categoryCounts[key] = (categoryCounts[key] || 0) + 1;
        });
      }
    }
  }

  // Because the Executor often duplicates entries (per-cycle + Fixes Summary),
  // this count may double-count a single fix that appears in both a cycle's
  // "Fixes Applied" and the final "Fixes Summary". That is acceptable — the
  // relative concentration ratio across categories is what matters.
  result.byCategory = categoryCounts;
  result.totalFixes = Object.values(categoryCounts).reduce((a, b) => a + b, 0);

  if (result.totalFixes >= 5) {
    const topEntry = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])[0];
    if (topEntry) {
      const [topCat, topN] = topEntry;
      const pct = (topN / result.totalFixes) * 100;
      if (pct >= 40) {
        result.concentrationWarning =
          `Category "${topCat}" is ${pct.toFixed(0)}% of executor fixes ` +
          `(${topN}/${result.totalFixes}) across ${result.reportsScanned} report(s). ` +
          `This concentration suggests a Builder/Explorer generation rule may be under-specified.`;
      }
    }
  }
  return result;
}

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
