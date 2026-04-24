# Explorer Report Template

**Owner:** Explorer Agent
**Purpose:** Documents the exploration results — what was discovered, what was verified, what was blocked. This report is the manifest used by the Executor and Reviewer.

**MANDATORY: Every section MUST be present with actual data. Use "None." or "No [X] detected." for empty sections — NEVER omit a section.**

---

## MANDATORY Header Fields — HARD STOP

**The first 4 fields below (Scenario, Type, Date, Pipeline Stage) are the STANDARD REPORT HEADER. ALL agent reports MUST include these 4 fields with actual values. This is non-negotiable — reports without Date or Pipeline Stage are incomplete.**

## Template

```markdown
# Explorer Report: {scenario}

**Scenario:** {name}
**Type:** {web | api | hybrid | mobile | mobile-hybrid}
**Date:** {Month DD, YYYY, HH:MM AM/PM UTC}
**Pipeline Stage:** Stage 1 — Explorer
**Duration:** {N}m {N}s (computed from startTime → endTime in metrics JSON)
**Outcome:** COMPLETE / PARTIAL (reason: {auth failure / app crash / context exhaustion})
**Steps:** {N}/{total} explored ({N} verified first-try, {N} retried, {N} blocked)
**Pages Discovered:** {N} pages → {N} page objects, {N} locator files ({totalElements} elements)
**Fidelity:** {N} VERIFY, {N} CAPTURE, {N} SCREENSHOT, {N} REPORT, {N} CALCULATE — all matched to spec
**App-Context:** {N} known patterns applied, {N} new patterns discovered
**Enriched.md:** Created / Already exists / NOT CREATED (reason)
**Chunks:** {N} of {total} ({mode}: DIRECT or CHUNKED — Chunk {N}, steps {start}-{end})

---

## Source Files Read
| File | Path | Status |
|------|------|--------|
| Scenario | scenarios/{type}/[{folder}/]{scenario}.md | Read |
| App-context | scenarios/app-contexts/{app}.md | Read / Not found |
| App-context | scenarios/app-contexts/{app}.md | Read / Not found |
| Skills registry | skills/registry.md | Read |
| Keyword reference | agents/shared/keyword-reference.md | Read |

---

## Step Results

| Step | Description | Status | Attempts | Selector Used | Notes |
|------|-------------|--------|----------|---------------|-------|
| 1 | Navigate to {{ENV.BASE_URL}} | VERIFIED | 1 | N/A (navigation) | Redirect chain: /login → /home |
| 2 | Login with SSO | VERIFIED | 1 | input[name="loginfmt"] | Microsoft SSO flow |
| 3 | Click filter icon | VERIFIED | 2 | th:first-child svg:last-of-type | SVG element, not IMG — attempt 1 used img selector |
| 4 | Enter filter text | VERIFIED | 2 | [data-testid="filter-input"] | fill() didn't trigger filter → used pressSequentially |
| 5 | VERIFY: Grid filtered | BLOCKED | 3 | .grid-cell | Grid content not accessible via DOM |
[MUST list EVERY step — no omissions. Status: VERIFIED / BLOCKED / SKIPPED (API in web)]

---

## Page Map
<!-- For EACH page discovered, list ALL interactive elements — not just the ones used -->

### Page: {PageName} (URL: {url | <variable>})
<!-- If multiple paths were observed for this page (role-specific routes, multi-tenant routes),
     emit URL as `<variable>` and add an OBSERVED_PATHS line below listing the paths.
     Builder MUST NOT hardcode a specific path when URL is <variable>. See explorer.md §4.8. -->
<!-- OBSERVED_PATHS: /admin/, /manager/, /user/ (only when URL is <variable>) -->
| Element | Role | TestID | ID | Name | Text | Type | Selector Used |
|---------|------|--------|----|------|------|------|---------------|
| Login button | button | submit-btn | login-submit | — | Sign In | button | testid=submit-btn |
| Email input | textbox | — | email | loginfmt | — | input | input[name="loginfmt"] |
[List ALL interactive elements on the page, including those NOT used by this scenario]

---

## Fidelity Summary
Source steps: {N} | Spec test.step() calls: {N} | Match: {YES/NO}
Blocked steps (test.fixme): {N}
VERIFY: {N}/{N} | VERIFY_SOFT: {N}/{N} | CAPTURE: {N}/{N}
SCREENSHOT: {N}/{N} | REPORT: {N}/{N} | SAVE: {N}/{N}
CALCULATE: {N}/{N} | API steps: {N}/{N}
Lifecycle hooks: beforeAll={Y/N/NA} beforeEach={Y/N/NA} afterEach={Y/N/NA} afterAll={Y/N/NA}
Missing or blocked items: {list each, or "None"}

---

## Files Generated
| File | Status | Details |
|------|--------|---------|
| output/locators/{page}.locators.json | new | {N} elements, {N} with type field |
| output/pages/{Page}Page.ts | new | {N} methods |
| output/pages/{Page}Page.ts | reused | Added {N} new methods |
| output/tests/{type}/[{folder}/]{scenario}.spec.ts | new | {N} test.step blocks |
| output/test-data/{type}/{scenario}.json | new | {N} fields |
| scenarios/app-contexts/{app}.md | updated | {N} new patterns |

---

## Dynamic Content Map
<!-- Record which user actions trigger asynchronous content loading -->
| Action | Step | Content That Loads | Wait Strategy Used | Approx Duration |
|--------|------|-------------------|-------------------|-----------------|
| Click filter icon | 3 | Filter popover + grid update | waitForSelector + waitForFunction | ~2s |
| Navigate to dashboard | 1 | Dashboard widgets load async | waitForLoadState('networkidle') | ~3s |
[List each observed dynamic content trigger, or "No dynamic content detected."]

---

## Capture Navigation Map
<!-- Breadcrumb trail: HOW each CAPTURE value was obtained -->
| Variable | Step | Element | Playwright Expression | Parameterized? |
|----------|------|---------|----------------------|----------------|
| {{subtotal}} | 7 | Subtotal label | .locator('.subtotal').textContent() | No |
| {{itemName}} | 5 | Grid row name | .locator('tr:first-child td.name').textContent() | Yes — uses testData.searchTerm |
[List each CAPTURE with its exact path, or "No captures in this scenario."]

---

## Row-Scoped Interactive Elements
<!-- Elements inside grid/table rows that need scoped selectors -->
| Step | Element | Row Anchor | Scoped Pattern |
|------|---------|-----------|----------------|
| 8 | Edit button | tr:has-text('{rowData}') | row.locator('button:has-text("Edit")') |
[List each row-scoped element, or "No row-scoped elements."]

---

## Charts and Graphs
| Step | Chart Title | Render Type | Readable Elements | Screenshot Taken |
|------|-------------|-------------|-------------------|-----------------|
| 12 | Revenue by Quarter | SVG | Axis labels, data values | Yes |
[List each chart encountered, or "No charts in this scenario."]

---

## Key Decisions Made
| Decision | Choice Made | Reason |
|----------|-------------|--------|
| navigate() URL source | process.env.BASE_URL | Single-app scenario |
| Login method | auth/sso-login (Microsoft SSO) | App-context: Microsoft SSO detected |
| Filter input interaction | pressSequentially (not fill) | fill() didn't trigger filter events |
| Grid row scoping | Scoped by row text content | Multiple rows have identical button selectors |
| Pacing strategy | // PACING: added after filter apply | Grid reload takes ~2s |
[Document each non-obvious decision, or "Standard patterns used — no special decisions."]

---

## App-Context Check
- [ ] PACING comments exist in generated code? {Y/N}
- [ ] App-context file exists for this app? {Y/N}
- [ ] If PACING=Y and app-context=N → **CREATED app-context file**
- [ ] If PACING=Y and app-context=Y → **UPDATED app-context file**

## App-Context Updates
{List new patterns written to app-context, or "None — no new patterns discovered."}

---

## Self-Audit Results
- Structural audit: {PASS / {N} issues fixed}
- Semantic audit: {PASS / {N} issues fixed}
- Fidelity count: {MATCH / {N} gaps fixed}
- Issues found: {N}
- Issues fixed: {list, or "None"}
- Remaining gaps: {list, or "None"}

---

## Observability
- **Tokens used:** {N}
- **Context window:** {N}%
- **Duration:** {N}m {N}s
- **Subagents spawned:** {N}
- **Skills activated:** {list — e.g., web/navigate, web/interact, auth/sso-login}
- **Snapshots taken:** {N} (token cost: ~{N}K tokens)
- **MCP interactions:** {N}

{If context window > 70%: "**WARNING:** Context window usage is high. Recommend subagent splitting for future runs."}

### Eval Metrics
| Metric | Value |
|--------|-------|
| Exploration accuracy | {N}% (steps verified first-try / total steps) |
| Retry rate | {N}% (steps needing 2-3 attempts / total steps) |
| Blocked rate | {N}% (test.fixme steps / total steps) |
| App-context hit rate | {N}% (known patterns used / total patterns tried) |
| Self-improvement | {N} new app-context patterns discovered |

---

## Issues and Warnings
{List any blocked steps, potential bugs, app quirks, or concerns. Or "None."}
```

---

## Save Location

- With folder: `output/reports/{folder}/explorer-report-{scenario}.md`
- Without folder: `output/reports/explorer-report-{scenario}.md`

## Sections That MUST Always Be Present

Even if empty, these sections MUST appear with an empty-state phrase:

| Section | Empty-State Phrase |
|---------|-------------------|
| Page Map | "No pages discovered (API-only scenario)." |
| Dynamic Content Map | "No dynamic content detected." |
| Capture Navigation Map | "No captures in this scenario." |
| Row-Scoped Elements | "No row-scoped elements." |
| Charts and Graphs | "No charts in this scenario." |
| App-Context Updates | "None — no new patterns discovered." |
| Issues and Warnings | "None." |
| Observability | MUST always be populated — include Duration, Skills activated, Snapshots, MCP interactions |
| Eval Metrics | MUST always be populated — include Exploration accuracy, Retry rate, Blocked rate, App-context hit rate, Self-improvement |
