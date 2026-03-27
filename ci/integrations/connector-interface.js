#!/usr/bin/env node

/**
 * connector-interface.js — Routes failure analysis to configured defect tracker
 *
 * Usage: node ci/integrations/connector-interface.js --analysis=failure-analysis.json --tracker=jira
 * Env: JIRA_URL, JIRA_PROJECT, JIRA_API_TOKEN, JIRA_USERNAME (for Jira)
 */

const fs = require('fs');
const path = require('path');

const args = {};
process.argv.slice(2).forEach(arg => {
  const match = arg.match(/^--([\w-]+)=(.+)$/);
  if (match) args[match[1]] = match[2];
});

const analysisFile = args.analysis;
const tracker = args.tracker || process.env.DEFECT_TRACKER || 'none';

if (!analysisFile || !fs.existsSync(analysisFile)) {
  console.error('Usage: --analysis=<file> --tracker=<jira|servicenow|none>');
  process.exit(1);
}

const analysis = JSON.parse(fs.readFileSync(analysisFile, 'utf-8'));

async function processFailures(failures, trackerName) {
  if (trackerName === 'none') {
    console.log(`No tracker configured. ${failures.length} failures would be reported.`);
    return;
  }

  let connector;
  try {
    const connectorPath = path.join(__dirname, `${trackerName}-connector.js`);
    if (!fs.existsSync(connectorPath)) {
      console.error(`Connector not found: ${connectorPath}`);
      process.exit(1);
    }
    const ConnectorClass = require(connectorPath);
    connector = new ConnectorClass();
  } catch (err) {
    console.error(`Failed to load ${trackerName}:`, err.message);
    process.exit(1);
  }

  let created = 0, updated = 0, skipped = 0;
  for (const failure of failures) {
    if (failure.action === 'AUTO_RETRY') { skipped++; continue; }
    const existing = await connector.searchExisting(failure.testId, failure.errorSignature);
    if (existing) {
      await connector.addComment(existing.id, failure);
      updated++;
    } else {
      await connector.createTicket(failure);
      created++;
    }
  }
  console.log(`Defects: ${created} created, ${updated} updated, ${skipped} skipped`);
}

const reportable = (analysis.failures || []).filter(f =>
  ['LIKELY_REGRESSION', 'NEEDS_TRIAGE', 'SELECTOR_ISSUE'].includes(f.action)
);

processFailures(reportable, tracker).catch(err => {
  console.error('Failed:', err.message);
  process.exit(1);
});
