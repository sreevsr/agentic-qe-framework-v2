# Dimension 8: API Test Quality (Weight: Medium)

**Applies to:** api, hybrid, mobile-hybrid. **N/A for:** web, mobile (pure native).

## Files to Examine
- Spec file and scenario `.md` from manifest

## Checklist — MUST score each item

- [ ] Uses Playwright's built-in `request` fixture (not axios/fetch)
- [ ] For hybrid: `{ page, request }` correctly destructured in test fixture
- [ ] API auth headers use `process.env.API_TOKEN` (not hardcoded)
- [ ] Response status assertions present for every API call
- [ ] Response body structure verified (not just status code)
- [ ] API chaining properly passes values between requests (CAPTURE → subsequent steps)
- [ ] CAPTURE steps on API responses correctly use property access (`body.id`, `body.data[0].name`)
- [ ] For hybrid: API assertions AND UI assertions are both present where scenario requires cross-channel verification
- [ ] If `## API Behavior: mock` declared: spec does NOT assert CRUD persistence (POST→GET chain relaxed)
- [ ] If `## API Behavior: live` or missing: spec DOES assert CRUD persistence where applicable

## Scoring
- **5/5** — All API calls have status + body assertions, proper chaining, correct fixture, mock/live respected
- **4/5** — 1-2 API calls missing body structure verification
- **3/5** — Some missing status assertions, or incorrect fixture for hybrid
- **2/5** — Using fetch/axios, or missing most assertions
- **1/5** — No API quality patterns at all

**Score: _/5**
