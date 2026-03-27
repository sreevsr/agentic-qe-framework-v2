/**
 * jira-connector.js — Jira REST API v3 integration
 *
 * Requires environment variables:
 *   JIRA_URL, JIRA_PROJECT, JIRA_API_TOKEN, JIRA_USERNAME
 *
 * Requires Node.js >= 18 (global fetch).
 */

// Priority mapping: failure action → Jira priority
const PRIORITY_MAP = {
  'LIKELY_REGRESSION': 'High',
  'CODE_ERROR': 'High',
  'SELECTOR_ISSUE': 'Medium',
  'NEEDS_TRIAGE': 'Low',
};

class JiraConnector {
  constructor() {
    this.baseUrl = process.env.JIRA_URL;
    this.project = process.env.JIRA_PROJECT;
    const username = process.env.JIRA_USERNAME;
    const token = process.env.JIRA_API_TOKEN;

    if (!this.baseUrl) throw new Error('JIRA_URL environment variable is required');
    if (!this.project) throw new Error('JIRA_PROJECT environment variable is required');
    if (!username) throw new Error('JIRA_USERNAME environment variable is required');
    if (!token) throw new Error('JIRA_API_TOKEN environment variable is required');

    this.auth = Buffer.from(`${username}:${token}`).toString('base64');

    // Verify fetch is available (Node.js >= 18)
    if (typeof fetch === 'undefined') {
      throw new Error('Global fetch not available. Requires Node.js >= 18.');
    }
  }

  async _request(method, endpoint, body) {
    const url = `${this.baseUrl}/rest/api/3${endpoint}`;
    const options = {
      method,
      headers: {
        'Authorization': `Basic ${this.auth}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    };

    // Only attach body for non-GET requests
    if (body && method !== 'GET') {
      options.body = JSON.stringify(body);
    }

    const resp = await fetch(url, options);
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Jira API error (${resp.status} ${resp.statusText}): ${text.substring(0, 500)}`);
    }
    return resp.json();
  }

  /**
   * Escape special characters in JQL string values to prevent injection
   */
  _escapeJql(value) {
    return value.replace(/[\\"']/g, '\\$&').replace(/[+\-&|!(){}[\]^~*?:/]/g, '\\\\$&');
  }

  async searchExisting(testId, errorSignature) {
    const safeTestId = this._escapeJql(testId);
    const jql = `project = "${this.project}" AND summary ~ "[Auto] ${safeTestId}" AND status != Done ORDER BY created DESC`;
    const result = await this._request('GET', `/search?jql=${encodeURIComponent(jql)}&maxResults=1`);
    if (result.issues && result.issues.length > 0) {
      return {
        id: result.issues[0].key,
        url: `${this.baseUrl}/browse/${result.issues[0].key}`,
      };
    }
    return null;
  }

  async createTicket(failure) {
    const priority = PRIORITY_MAP[failure.action] || 'Medium';
    const ciRunUrl = process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY && process.env.GITHUB_RUN_ID
      ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
      : 'Local run (no CI URL)';

    const descriptionLines = [
      `**Automated defect from Agentic QE Framework v2**`,
      ``,
      `**Test:** ${failure.testId}`,
      `**Classification:** ${failure.action} (${failure.confidence || 'unknown'} confidence)`,
      `**Error Type:** ${failure.errorType || 'unknown'}`,
      `**Priority:** ${priority}`,
      ``,
      `**Error Message:**`,
      `{code}${failure.errorMessage || 'No error message'}{code}`,
      ``,
      `**CI Run:** ${ciRunUrl}`,
      `**Timestamp:** ${new Date().toISOString()}`,
    ];

    const body = {
      fields: {
        project: { key: this.project },
        issuetype: { name: 'Bug' },
        summary: `[Auto] Test failure: ${failure.testId}`,
        description: {
          type: 'doc',
          version: 1,
          content: [{
            type: 'paragraph',
            content: [{ type: 'text', text: descriptionLines.join('\n') }],
          }],
        },
        labels: ['auto-created', 'test-failure', failure.action.toLowerCase()],
        priority: { name: priority },
      },
    };

    const result = await this._request('POST', '/issue', body);
    return {
      id: result.key,
      url: `${this.baseUrl}/browse/${result.key}`,
    };
  }

  async addComment(ticketId, failure) {
    const ciRunUrl = process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY && process.env.GITHUB_RUN_ID
      ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
      : 'Local run';

    const commentLines = [
      `**Failure recurrence detected**`,
      ``,
      `**Date:** ${new Date().toISOString()}`,
      `**Classification:** ${failure.action}`,
      `**Error:** ${(failure.errorMessage || '').substring(0, 500)}`,
      `**CI Run:** ${ciRunUrl}`,
    ];

    await this._request('POST', `/issue/${ticketId}/comment`, {
      body: {
        type: 'doc',
        version: 1,
        content: [{
          type: 'paragraph',
          content: [{ type: 'text', text: commentLines.join('\n') }],
        }],
      },
    });
  }
}

module.exports = JiraConnector;
