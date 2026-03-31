/**
 * report-generator.ts — Produces markdown and JUnit XML reports from replay results.
 */

import * as fs from 'fs';
import * as path from 'path';

export interface ReplayResults {
  scenario: string;
  planHash: string;
  startTime: string;
  endTime: string;
  totalDuration: number;
  environment: Record<string, string>;
  stepResults: StepReportEntry[];
  capturedVariables: Record<string, any>;
  screenshots: { name: string; step: number; file: string }[];
  popupDismissals: string[];
}

export interface StepReportEntry {
  id: number;
  section: string;
  description: string;
  type: string;
  status: 'pass' | 'fail' | 'skip';
  duration: number;
  evidence?: string;
  error?: string;
  screenshot?: string;
}

/**
 * Generate a markdown report from replay results.
 */
export function generateMarkdownReport(results: ReplayResults): string {
  const passed = results.stepResults.filter(s => s.status === 'pass').length;
  const failed = results.stepResults.filter(s => s.status === 'fail').length;
  const skipped = results.stepResults.filter(s => s.status === 'skip').length;
  const total = results.stepResults.length;
  const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;
  const avgTime = total > 0 ? Math.round(results.totalDuration / total) : 0;
  const verdict = failed === 0 ? 'PASS' : 'FAIL';

  let md = `# Replay Execution Report: ${results.scenario}

## Summary
| Metric | Value |
|--------|-------|
| Scenario | ${results.scenario} |
| Plan Hash | ${results.planHash.substring(0, 12)}... |
| Date | ${results.startTime} |
| Total Steps | ${total} |
| Passed | ${passed} |
| Failed | ${failed} |
| Skipped | ${skipped} |
| Pass Rate | ${passRate}% |
| Total Time | ${(results.totalDuration / 1000).toFixed(1)}s |
| Avg Time/Step | ${avgTime}ms |
| Popup Dismissals | ${results.popupDismissals.length} |
| Screenshots | ${results.screenshots.length} |
| Verdict | **${verdict}** |

## Environment
| Variable | Value |
|----------|-------|
`;

  for (const [key, value] of Object.entries(results.environment)) {
    // Mask sensitive values
    const masked = ['PASSWORD', 'TOKEN', 'SECRET', 'CVC', 'CARD'].some(s => key.toUpperCase().includes(s))
      ? '***' : value;
    md += `| ${key} | ${masked} |\n`;
  }

  // Step Results
  md += `\n## Step Results\n\n`;
  md += `| # | Section | Step | Type | Result | Time | Notes |\n`;
  md += `|---|---------|------|------|--------|------|-------|\n`;

  for (const step of results.stepResults) {
    const statusIcon = step.status === 'pass' ? 'PASS' : step.status === 'fail' ? 'FAIL' : 'SKIP';
    const notes = step.error ? step.error.substring(0, 80) : (step.evidence || '').substring(0, 80);
    md += `| ${step.id} | ${step.section || ''} | ${step.description.substring(0, 50)} | ${step.type} | ${statusIcon} | ${step.duration}ms | ${notes} |\n`;
  }

  // Failed Steps Detail
  const failedSteps = results.stepResults.filter(s => s.status === 'fail');
  if (failedSteps.length > 0) {
    md += `\n## Failed Steps Detail\n\n`;
    for (const step of failedSteps) {
      md += `### Step ${step.id}: ${step.description}\n`;
      md += `- **Type:** ${step.type}\n`;
      md += `- **Error:** ${step.error || 'Unknown'}\n`;
      if (step.screenshot) {
        md += `- **Screenshot:** ${step.screenshot}\n`;
      }
      md += `\n`;
    }
  }

  // Captured Variables
  const capturedEntries = Object.entries(results.capturedVariables).filter(
    ([k]) => !k.startsWith('_') && k !== 'ENV' && k !== 'testData' && k !== 'dataSources'
  );
  if (capturedEntries.length > 0) {
    md += `\n## Captured Variables\n\n`;
    md += `| Variable | Value |\n`;
    md += `|----------|-------|\n`;
    for (const [key, value] of capturedEntries) {
      const displayValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
      md += `| ${key} | ${displayValue.substring(0, 100)} |\n`;
    }
  }

  // Screenshots
  if (results.screenshots.length > 0) {
    md += `\n## Screenshots\n\n`;
    md += `| Name | Step | File |\n`;
    md += `|------|------|------|\n`;
    for (const ss of results.screenshots) {
      md += `| ${ss.name} | ${ss.step} | ${ss.file} |\n`;
    }
  }

  // Popup Dismissals
  if (results.popupDismissals.length > 0) {
    md += `\n## Popup Dismissals\n\n`;
    for (const d of results.popupDismissals) {
      md += `- ${d}\n`;
    }
  }

  return md;
}

/**
 * Generate a JUnit XML report (for CI/CD integration).
 */
export function generateJUnitXml(results: ReplayResults): string {
  const passed = results.stepResults.filter(s => s.status === 'pass').length;
  const failed = results.stepResults.filter(s => s.status === 'fail').length;
  const skipped = results.stepResults.filter(s => s.status === 'skip').length;
  const total = results.stepResults.length;
  const timeSeconds = (results.totalDuration / 1000).toFixed(3);

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<testsuites tests="${total}" failures="${failed}" errors="0" skipped="${skipped}" time="${timeSeconds}">\n`;
  xml += `  <testsuite name="${results.scenario}" tests="${total}" failures="${failed}" errors="0" skipped="${skipped}" time="${timeSeconds}">\n`;

  for (const step of results.stepResults) {
    const stepTime = (step.duration / 1000).toFixed(3);
    const testName = `Step ${step.id} — ${step.description}`;
    const className = step.section || results.scenario;

    xml += `    <testcase name="${escapeXml(testName)}" classname="${escapeXml(className)}" time="${stepTime}">\n`;

    if (step.status === 'fail') {
      xml += `      <failure message="${escapeXml(step.error || 'Assertion failed')}">${escapeXml(step.error || '')}</failure>\n`;
    } else if (step.status === 'skip') {
      xml += `      <skipped/>\n`;
    }

    if (step.evidence) {
      xml += `      <system-out>${escapeXml(step.evidence)}</system-out>\n`;
    }

    xml += `    </testcase>\n`;
  }

  xml += `  </testsuite>\n`;
  xml += `</testsuites>\n`;

  return xml;
}

/**
 * Save report to file.
 */
export function saveReport(
  results: ReplayResults,
  outputPath: string,
  format: 'markdown' | 'junit' = 'markdown',
): string {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  const content = format === 'junit'
    ? generateJUnitXml(results)
    : generateMarkdownReport(results);

  fs.writeFileSync(outputPath, content);
  return outputPath;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
