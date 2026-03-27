#!/usr/bin/env node

/**
 * connector-interface.js — Routes failure analysis to configured defect tracker
 *
 * Usage:
 *   node ci/integrations/connector-interface.js --analysis=failure-analysis.json --tracker=jira
 *   node ci/integrations/connector-interface.js --analysis=failure-analysis.json --tracker=jira --dry-run
 *
 * Env: JIRA_URL, JIRA_PROJECT, JIRA_API_TOKEN, JIRA_USERNAME (for Jira)
 */

const fs = require('fs');
const path = require('path');

const args = {};
process.argv.slice(2).forEach(arg => {
  const match = arg.match(/^--([\w-]+)(?:=(.+))?$/);
  if (match) args[match[1]] = match[2] || true;
});

const analysisFile = args.analysis;
const tracker = args.tracker || process.env.DEFECT_TRACKER || 'none';
const dryRun = args['dry-run'] === true;

if (!analysisFile || !fs.existsSync(analysisFile)) {
  console.error('Usage: --analysis=<file> --tracker=<jira|servicenow|none> [--dry-run]');
  process.exit(1);
}

const analysis = JSON.parse(fs.readFileSync(analysisFile, 'utf-8'));

async function processFailures(failures, trackerName) {
  const results = { created: 0, updated: 0, skipped: 0, skippedDetails: [], tickets: [] };

  if (trackerName === 'none') {
    console.log(`No tracker configured. ${failures.length} failures would be reported.`);
    results.skipped = failures.length;
    return results;
  }

  let connector;
  if (!dryRun) {
    try {
      const connectorPath = path.join(__dirname, `${trackerName}-connector.js`);
      if (!fs.existsSync(connectorPath)) {
        console.error(`Connector not found: ${connectorPath}`);
        console.log('Available connectors: jira, servicenow');
        process.exit(1);
      }
      const ConnectorClass = require(connectorPath);
      connector = new ConnectorClass();
    } catch (err) {
      console.error(`Failed to load ${trackerName}:`, err.message);
      process.exit(1);
    }
  }

  for (const failure of failures) {
    // Skip AUTO_RETRY and ENVIRONMENT_ISSUE — not defects
    if (failure.action === 'AUTO_RETRY') {
      results.skipped++;
      results.skippedDetails.push(`${failure.testId}: AUTO_RETRY (flaky, not a defect)`);
      continue;
    }
    if (failure.action === 'ENVIRONMENT_ISSUE') {
      results.skipped++;
      results.skippedDetails.push(`${failure.testId}: ENVIRONMENT_ISSUE (infra, not a defect)`);
      continue;
    }

    if (dryRun) {
      console.log(`[DRY RUN] Would create/update ticket for: ${failure.testId} (${failure.action})`);
      results.created++;
      continue;
    }

    // Deduplication: search for existing ticket
    const existing = await connector.searchExisting(failure.testId, failure.errorSignature);
    if (existing) {
      await connector.addComment(existing.id, failure);
      results.updated++;
      results.tickets.push({ id: existing.id, action: 'updated', testId: failure.testId });
      console.log(`Updated existing ticket ${existing.id} for: ${failure.testId}`);
    } else {
      const ticket = await connector.createTicket(failure);
      results.created++;
      results.tickets.push({ id: ticket.id, action: 'created', testId: failure.testId });
      console.log(`Created new ticket ${ticket.id} for: ${failure.testId}`);
    }
  }

  return results;
}

// Report these failure types as defects
const REPORTABLE_ACTIONS = ['LIKELY_REGRESSION', 'NEEDS_TRIAGE', 'SELECTOR_ISSUE', 'CODE_ERROR'];
const reportable = (analysis.failures || []).filter(f => REPORTABLE_ACTIONS.includes(f.action));

console.log(`\nDefect Tracking${dryRun ? ' [DRY RUN]' : ''}:`);
console.log(`  Tracker: ${tracker}`);
console.log(`  Total failures: ${(analysis.failures || []).length}`);
console.log(`  Reportable: ${reportable.length}\n`);

processFailures(reportable, tracker)
  .then(results => {
    console.log(`\nSummary: ${results.created} created, ${results.updated} updated, ${results.skipped} skipped`);
    if (results.skippedDetails.length > 0) {
      console.log('Skipped:');
      results.skippedDetails.forEach(d => console.log(`  - ${d}`));
    }

    // Write summary to file for CI artifact upload
    const summaryFile = path.join(path.dirname(analysisFile), 'defect-tracking-summary.json');
    fs.writeFileSync(summaryFile, JSON.stringify({
      timestamp: new Date().toISOString(),
      tracker, dryRun,
      ...results,
    }, null, 2));
    console.log(`\nSummary written: ${summaryFile}`);
  })
  .catch(err => {
    console.error('Defect tracking failed:', err.message);
    process.exit(1);
  });
