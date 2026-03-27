/**
 * jira-connector.js — Jira REST API v3 integration
 * Requires: JIRA_URL, JIRA_PROJECT, JIRA_API_TOKEN, JIRA_USERNAME
 */

class JiraConnector {
  constructor() {
    this.baseUrl = process.env.JIRA_URL;
    this.project = process.env.JIRA_PROJECT;
    this.auth = Buffer.from(`${process.env.JIRA_USERNAME}:${process.env.JIRA_API_TOKEN}`).toString('base64');
    if (!this.baseUrl || !this.project) throw new Error('JIRA_URL and JIRA_PROJECT required');
  }

  async _request(method, endpoint, body) {
    const resp = await fetch(`${this.baseUrl}/rest/api/3${endpoint}`, {
      method, body: body ? JSON.stringify(body) : undefined,
      headers: { 'Authorization': `Basic ${this.auth}`, 'Content-Type': 'application/json', 'Accept': 'application/json' },
    });
    if (!resp.ok) throw new Error(`Jira ${resp.status}: ${await resp.text()}`);
    return resp.json();
  }

  async searchExisting(testId) {
    const jql = `project="${this.project}" AND summary~"[Auto] ${testId}" AND status!=Done`;
    const r = await this._request('GET', `/search?jql=${encodeURIComponent(jql)}&maxResults=1`);
    return r.issues?.length > 0 ? { id: r.issues[0].key } : null;
  }

  async createTicket(failure) {
    const r = await this._request('POST', '/issue', {
      fields: {
        project: { key: this.project }, issuetype: { name: 'Bug' },
        summary: `[Auto] Test failure: ${failure.testId}`,
        description: { type: 'doc', version: 1, content: [{ type: 'paragraph', content: [{ type: 'text', text: `Error: ${failure.errorMessage}\nClassification: ${failure.action}` }] }] },
        labels: ['auto-created', 'test-failure'],
      }
    });
    return { id: r.key };
  }

  async addComment(ticketId, failure) {
    await this._request('POST', `/issue/${ticketId}/comment`, {
      body: { type: 'doc', version: 1, content: [{ type: 'paragraph', content: [{ type: 'text', text: `Recurrence: ${new Date().toISOString()}\nError: ${failure.errorMessage}` }] }] }
    });
  }
}

module.exports = JiraConnector;
