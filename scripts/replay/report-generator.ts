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
  /** Path to Playwright trace zip (only on failure) */
  tracePath?: string;
  /** Path to video recording (only on failure) */
  videoPath?: string;
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
    ([k]) => !k.startsWith('_') && k !== 'ENV' && k !== 'testData' && k !== 'dataSources' && k !== 'sharedState'
  );
  if (capturedEntries.length > 0) {
    md += `\n## Captured Variables\n\n`;
    md += `| Variable | Value |\n`;
    md += `|----------|-------|\n`;
    const SENSITIVE_KEYS = ['password', 'token', 'secret', 'cvc', 'cvv', 'card', 'key', 'auth', 'credential'];
    for (const [key, value] of capturedEntries) {
      const isSensitive = SENSITIVE_KEYS.some(s => key.toLowerCase().includes(s));
      const displayValue = isSensitive ? '***' : (typeof value === 'object' ? JSON.stringify(value) : String(value));
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

  // Failure Artifacts (trace, video)
  if (results.tracePath || results.videoPath) {
    md += `\n## Failure Artifacts\n\n`;
    if (results.tracePath) {
      md += `- **Trace:** ${results.tracePath}\n`;
      md += `  - View: \`npx playwright show-trace ${results.tracePath}\`\n`;
    }
    if (results.videoPath) {
      md += `- **Video:** ${results.videoPath}\n`;
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
  tags: string[] = [],
): string {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  const content = format === 'junit'
    ? generateJUnitXml(results)
    : generateMarkdownReport(results);

  fs.writeFileSync(outputPath, content);

  // Save Allure result alongside the primary report (same directory level)
  const allureDir = path.join(path.dirname(outputPath), '..', 'test-results', 'allure-results');
  saveAllureResult(results, allureDir, tags);

  return outputPath;
}

/**
 * Generate an Allure-compatible JSON result for CI dashboard integration.
 * Produces one result file per scenario, compatible with allure-commandline.
 */
export function generateAllureResult(results: ReplayResults, tags: string[] = []): object {
  const passed = results.stepResults.filter(s => s.status === 'pass').length;
  const failed = results.stepResults.filter(s => s.status === 'fail').length;
  const total = results.stepResults.length;

  const allureStatus = failed === 0 ? 'passed' : 'failed';
  const startMs = new Date(results.startTime).getTime();
  const stopMs = new Date(results.endTime).getTime();

  // Map step results to Allure steps with cumulative timestamps
  let cumulativeMs = 0;
  const allureSteps = results.stepResults.map(step => {
    const stepStatus = step.status === 'pass' ? 'passed'
      : step.status === 'fail' ? 'failed'
      : 'skipped';

    const stepStart = startMs + cumulativeMs;
    cumulativeMs += step.duration;
    const stepStop = startMs + cumulativeMs;

    const allureStep: any = {
      name: `[${step.id}] ${step.description}`,
      status: stepStatus,
      stage: 'finished',
      start: stepStart,
      stop: stepStop,
      parameters: [
        { name: 'type', value: step.type },
        { name: 'section', value: step.section || '' },
      ],
    };

    if (step.error) {
      allureStep.statusDetails = {
        message: step.error.substring(0, 500),
        trace: step.error,
      };
    }

    if (step.evidence) {
      allureStep.parameters.push({ name: 'evidence', value: step.evidence.substring(0, 200) });
    }

    // Attach screenshot if present
    if (step.screenshot) {
      allureStep.attachments = [{
        name: `step-${step.id}-screenshot`,
        source: step.screenshot,
        type: 'image/png',
      }];
    }

    return allureStep;
  });

  // Build labels from tags
  const labels: Array<{ name: string; value: string }> = [
    { name: 'suite', value: results.scenario },
    { name: 'framework', value: 'agentic-qe-framework' },
    { name: 'resultFormat', value: 'allure2' },
  ];

  for (const tag of tags) {
    if (['P0', 'P1', 'P2', 'P3'].includes(tag.toUpperCase())) {
      labels.push({ name: 'severity', value: tag.toLowerCase() === 'p0' ? 'blocker' : tag.toLowerCase() === 'p1' ? 'critical' : tag.toLowerCase() === 'p2' ? 'normal' : 'minor' });
    } else {
      labels.push({ name: 'tag', value: tag });
    }
  }

  return {
    uuid: generateUuid(),
    historyId: generateHistoryId(results.scenario),
    name: results.scenario,
    fullName: `replay/${results.scenario}`,
    status: allureStatus,
    stage: 'finished',
    start: startMs,
    stop: stopMs,
    labels,
    links: [],
    parameters: [
      { name: 'planHash', value: results.planHash.substring(0, 12) },
      { name: 'totalSteps', value: String(total) },
      { name: 'passed', value: String(passed) },
      { name: 'failed', value: String(failed) },
    ],
    steps: allureSteps,
    attachments: [
      ...results.screenshots.map(ss => ({
        name: ss.name,
        source: ss.file,
        type: 'image/png',
      })),
      ...(results.tracePath ? [{ name: 'trace', source: results.tracePath, type: 'application/zip' }] : []),
      ...(results.videoPath ? [{ name: 'video', source: results.videoPath, type: 'video/webm' }] : []),
    ],
  };
}

/**
 * Save Allure result JSON to the allure-results directory.
 */
export function saveAllureResult(
  results: ReplayResults,
  outputDir: string = 'output/test-results/allure-results',
  tags: string[] = [],
): string {
  fs.mkdirSync(outputDir, { recursive: true });
  const allureResult = generateAllureResult(results, tags);
  const filePath = path.join(outputDir, `${results.scenario}-result.json`);
  fs.writeFileSync(filePath, JSON.stringify(allureResult, null, 2));
  return filePath;
}

function generateUuid(): string {
  // Simple UUID v4 without external dependency
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function generateHistoryId(scenario: string): string {
  // Deterministic hash for Allure history tracking (same scenario = same history)
  let hash = 0;
  for (let i = 0; i < scenario.length; i++) {
    const char = scenario.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
