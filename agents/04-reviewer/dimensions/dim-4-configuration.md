# Dimension 4: Configuration (Weight: Medium)

**Applies to:** ALL types. For mobile: check WDIO config instead of playwright.config.

## Files to Examine
- `output/playwright.config.ts` (web/api/hybrid)
- WDIO config (mobile) — if applicable

## Checklist — MUST score each item

- [ ] `channel: 'chrome'` (not `browserName: 'chrome'`)
- [ ] Timeouts configured (action, navigation)
- [ ] Screenshot on failure enabled (`screenshot: 'only-on-failure'`)
- [ ] Trace collection configured (`trace: 'retain-on-failure'` or `'on-first-retry'`)
- [ ] Video configured (`video: 'retain-on-failure'`)
- [ ] baseURL set correctly (reads from `process.env.BASE_URL`)

## Scoring
- **5/5** — All config items correct and present
- **4/5** — 1 missing config item
- **3/5** — 2-3 missing items, or incorrect channel setting
- **2/5** — Most config items missing or incorrect
- **1/5** — No meaningful configuration

**Score: _/5**
