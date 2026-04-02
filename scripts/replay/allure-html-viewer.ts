/**
 * allure-html-viewer.ts — Generates a standalone HTML report from Allure result JSON files.
 *
 * No external dependencies (no allure-commandline). Produces a single self-contained HTML
 * file that can be opened in any browser.
 *
 * Usage:
 *   npx tsx scripts/replay/allure-html-viewer.ts [--input=output/test-results/allure-results] [--output=output/allure-report.html]
 */

import * as fs from 'fs';
import * as path from 'path';

interface AllureResult {
  uuid: string;
  name: string;
  fullName: string;
  status: string;
  start: number;
  stop: number;
  labels: Array<{ name: string; value: string }>;
  parameters: Array<{ name: string; value: string }>;
  steps: Array<{
    name: string;
    status: string;
    start: number;
    stop: number;
    parameters?: Array<{ name: string; value: string }>;
    statusDetails?: { message: string; trace?: string };
    attachments?: Array<{ name: string; source: string; type: string }>;
  }>;
  attachments: Array<{ name: string; source: string; type: string }>;
}

function loadResults(inputDir: string): AllureResult[] {
  if (!fs.existsSync(inputDir)) {
    console.error(`Input directory not found: ${inputDir}`);
    process.exit(1);
  }

  const files = fs.readdirSync(inputDir).filter(f => f.endsWith('-result.json'));
  if (files.length === 0) {
    console.error(`No result files found in: ${inputDir}`);
    process.exit(1);
  }

  const results: AllureResult[] = [];
  for (const f of files) {
    try {
      results.push(JSON.parse(fs.readFileSync(path.join(inputDir, f), 'utf-8')));
    } catch (err: any) {
      console.warn(`Warning: Skipping malformed result file ${f}: ${err.message}`);
    }
  }
  return results;
}

function generateHtml(results: AllureResult[]): string {
  const totalTests = results.length;
  const passed = results.filter(r => r.status === 'passed').length;
  const failed = results.filter(r => r.status === 'failed').length;
  const passRate = totalTests > 0 ? Math.round((passed / totalTests) * 100) : 0;

  const totalSteps = results.reduce((sum, r) => sum + (r.steps?.length || 0), 0);
  const passedSteps = results.reduce((sum, r) =>
    sum + (r.steps?.filter(s => s.status === 'passed').length || 0), 0);
  const failedSteps = results.reduce((sum, r) =>
    sum + (r.steps?.filter(s => s.status === 'failed').length || 0), 0);

  const totalDuration = results.reduce((sum, r) => sum + (r.stop - r.start), 0);

  // Build test cards
  const testCards = results.map(r => {
    const duration = ((r.stop - r.start) / 1000).toFixed(1);
    const date = new Date(r.start).toLocaleString();
    const severity = r.labels?.find(l => l.name === 'severity')?.value || 'normal';
    const tags = r.labels?.filter(l => l.name === 'tag').map(l => l.value) || [];

    const stepsHtml = (r.steps || []).map(step => {
      const stepDuration = ((step.stop - step.start) / 1000).toFixed(1);
      const statusClass = step.status === 'passed' ? 'step-pass' : step.status === 'failed' ? 'step-fail' : 'step-skip';
      const statusIcon = step.status === 'passed' ? '&#10004;' : step.status === 'failed' ? '&#10008;' : '&#8722;';
      const evidence = step.parameters?.find(p => p.name === 'evidence')?.value || '';
      const type = step.parameters?.find(p => p.name === 'type')?.value || '';
      const error = step.statusDetails?.message || '';
      const stepScreenshots = step.attachments?.filter(a => a.type === 'image/png') || [];

      return `
        <div class="step ${statusClass}">
          <span class="step-icon">${statusIcon}</span>
          <span class="step-name">${escapeHtml(step.name)}</span>
          <span class="step-type">${type}</span>
          <span class="step-time">${stepDuration}s</span>
          ${evidence ? `<div class="step-evidence">${escapeHtml(evidence)}</div>` : ''}
          ${error ? `<div class="step-error">${escapeHtml(error)}</div>` : ''}
          ${stepScreenshots.length > 0 ? `<div class="step-screenshot"><img src="file://${stepScreenshots[0].source}" alt="failure screenshot" onerror="this.style.display='none';this.parentElement.querySelector('.fallback').style.display='block'" /><span class="fallback" style="display:none">Screenshot: ${escapeHtml(stepScreenshots[0].source)}</span></div>` : ''}
        </div>`;
    }).join('\n');

    const statusClass = r.status === 'passed' ? 'test-pass' : 'test-fail';
    const statusIcon = r.status === 'passed' ? '&#10004; PASS' : '&#10008; FAIL';
    const tagsHtml = tags.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('');
    const severityHtml = `<span class="severity severity-${severity}">${severity}</span>`;

    return `
      <div class="test-card ${statusClass}">
        <div class="test-header" onclick="this.parentElement.classList.toggle('expanded')">
          <span class="test-status">${statusIcon}</span>
          <span class="test-name">${escapeHtml(r.name)}</span>
          ${severityHtml}
          ${tagsHtml}
          <span class="test-duration">${duration}s</span>
          <span class="test-date">${date}</span>
          <span class="expand-icon">&#9660;</span>
        </div>
        <div class="test-steps">
          ${stepsHtml}
          ${r.attachments?.some(a => a.type === 'application/zip' || a.type === 'video/webm') ? `
          <div class="test-artifacts">
            <strong>Failure Artifacts:</strong>
            ${r.attachments.filter(a => a.type === 'application/zip').map(a => `<span class="artifact">Trace: <code>${escapeHtml(a.source)}</code></span>`).join('')}
            ${r.attachments.filter(a => a.type === 'video/webm').map(a => `<span class="artifact">Video: <code>${escapeHtml(a.source)}</code></span>`).join('')}
          </div>` : ''}
        </div>
      </div>`;
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>QE Framework — Test Report</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; color: #333; padding: 20px; }
    h1 { font-size: 1.5rem; margin-bottom: 4px; }
    .subtitle { color: #666; font-size: 0.9rem; margin-bottom: 20px; }
    .summary { display: flex; gap: 16px; margin-bottom: 24px; flex-wrap: wrap; }
    .summary-card { background: white; border-radius: 8px; padding: 16px 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); min-width: 140px; }
    .summary-card .label { font-size: 0.75rem; color: #888; text-transform: uppercase; letter-spacing: 0.5px; }
    .summary-card .value { font-size: 1.8rem; font-weight: 700; margin-top: 4px; }
    .summary-card .value.green { color: #22c55e; }
    .summary-card .value.red { color: #ef4444; }
    .summary-card .value.blue { color: #3b82f6; }
    .test-card { background: white; border-radius: 8px; margin-bottom: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); overflow: hidden; }
    .test-header { display: flex; align-items: center; gap: 12px; padding: 12px 16px; cursor: pointer; flex-wrap: wrap; }
    .test-header:hover { background: #f9f9f9; }
    .test-status { font-weight: 700; font-size: 0.85rem; min-width: 60px; }
    .test-pass .test-status { color: #22c55e; }
    .test-fail .test-status { color: #ef4444; }
    .test-name { font-weight: 600; flex: 1; }
    .test-duration { color: #888; font-size: 0.85rem; }
    .test-date { color: #aaa; font-size: 0.8rem; }
    .expand-icon { color: #ccc; transition: transform 0.2s; }
    .test-card.expanded .expand-icon { transform: rotate(180deg); }
    .test-steps { display: none; padding: 0 16px 12px; border-top: 1px solid #eee; }
    .test-card.expanded .test-steps { display: block; }
    .step { display: flex; align-items: flex-start; gap: 8px; padding: 6px 0; border-bottom: 1px solid #f5f5f5; flex-wrap: wrap; }
    .step:last-child { border-bottom: none; }
    .step-icon { font-size: 0.9rem; min-width: 16px; }
    .step-pass .step-icon { color: #22c55e; }
    .step-fail .step-icon { color: #ef4444; }
    .step-skip .step-icon { color: #aaa; }
    .step-name { flex: 1; font-size: 0.9rem; }
    .step-type { background: #f0f0f0; padding: 1px 6px; border-radius: 3px; font-size: 0.75rem; color: #666; }
    .step-time { color: #aaa; font-size: 0.8rem; min-width: 40px; text-align: right; }
    .step-evidence { width: 100%; font-size: 0.8rem; color: #666; padding-left: 24px; margin-top: 2px; }
    .step-error { width: 100%; font-size: 0.8rem; color: #ef4444; padding-left: 24px; margin-top: 2px; background: #fef2f2; padding: 4px 8px 4px 24px; border-radius: 4px; }
    .step-screenshot { width: 100%; margin-top: 4px; padding-left: 24px; }
    .step-screenshot img { max-width: 100%; max-height: 300px; border: 1px solid #ddd; border-radius: 4px; cursor: pointer; }
    .step-screenshot img:hover { max-height: none; }
    .tag { background: #e0f2fe; color: #0369a1; padding: 2px 8px; border-radius: 10px; font-size: 0.75rem; }
    .severity { padding: 2px 8px; border-radius: 10px; font-size: 0.75rem; font-weight: 600; }
    .severity-blocker { background: #fecaca; color: #991b1b; }
    .severity-critical { background: #fed7aa; color: #9a3412; }
    .severity-normal { background: #e0e7ff; color: #3730a3; }
    .severity-minor { background: #f0fdf4; color: #166534; }
    .test-artifacts { margin-top: 8px; padding: 8px 12px; background: #fff7ed; border-radius: 4px; font-size: 0.85rem; }
    .test-artifacts strong { display: block; margin-bottom: 4px; }
    .artifact { display: block; margin: 2px 0; }
    .artifact code { background: #f5f5f5; padding: 1px 4px; border-radius: 3px; font-size: 0.8rem; }
    .footer { margin-top: 24px; text-align: center; color: #aaa; font-size: 0.8rem; }
  </style>
</head>
<body>
  <h1>Agentic QE Framework — Test Report</h1>
  <div class="subtitle">Generated ${new Date().toLocaleString()} | ${totalTests} scenario(s)</div>

  <div class="summary">
    <div class="summary-card">
      <div class="label">Pass Rate</div>
      <div class="value ${passRate === 100 ? 'green' : passRate >= 80 ? 'blue' : 'red'}">${passRate}%</div>
    </div>
    <div class="summary-card">
      <div class="label">Scenarios</div>
      <div class="value blue">${totalTests}</div>
    </div>
    <div class="summary-card">
      <div class="label">Steps Passed</div>
      <div class="value green">${passedSteps}</div>
    </div>
    <div class="summary-card">
      <div class="label">Steps Failed</div>
      <div class="value ${failedSteps > 0 ? 'red' : 'green'}">${failedSteps}</div>
    </div>
    <div class="summary-card">
      <div class="label">Total Duration</div>
      <div class="value blue">${(totalDuration / 1000).toFixed(1)}s</div>
    </div>
  </div>

  ${testCards}

  <div class="footer">Agentic QE Framework v3 | Plan-based deterministic replay with self-healing</div>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// --- CLI ---

function main() {
  const args: Record<string, string> = {};
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith('--')) {
      const [key, ...rest] = arg.slice(2).split('=');
      args[key] = rest.join('=') || '';
    }
  }

  const inputDir = args.input || 'output/test-results/allure-results';
  const outputFile = args.output || 'output/allure-report.html';

  console.log(`Reading results from: ${inputDir}`);
  const results = loadResults(inputDir);
  console.log(`Found ${results.length} test result(s)`);

  const html = generateHtml(results);
  fs.mkdirSync(path.dirname(outputFile), { recursive: true });
  fs.writeFileSync(outputFile, html);
  console.log(`Report saved to: ${outputFile}`);
  console.log(`Open in browser: file://${path.resolve(outputFile)}`);
}

main();
