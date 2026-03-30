# Builder Report Template

**Owner:** Builder Agent
**Purpose:** Documents code generation results — files created, locator usage, fidelity match, missing elements. Feeds into the pipeline summary.

**MANDATORY: Every section MUST be present with actual data.**

---

## MANDATORY Header Fields — HARD STOP

**The first 4 fields below (Scenario, Type, Date, Pipeline Stage) are the STANDARD REPORT HEADER. ALL agent reports MUST include these 4 fields with actual values.**

## Template

```markdown
# Builder Report: {scenario}

**Scenario:** {name}
**Type:** {web | api | hybrid | mobile | mobile-hybrid}
**Date:** {Month DD, YYYY, HH:MM AM/PM UTC}
**Pipeline Stage:** Stage 1b — Builder
**Outcome:** COMPLETE / PARTIAL
**Pages Generated:** {N} page objects from {N} enriched.md sections
**Spec Steps:** {N} test.step() blocks matching {N} scenario steps
**Fidelity:** {N} VERIFY, {N} CAPTURE, {N} SCREENSHOT, {N} REPORT, {N} CALCULATE
**Missing Elements:** {N} steps flagged with test.fixme (Scout gaps)
**Blocked Steps:** {N} steps from Explorer's blocked list

---

## Files Generated
| File | Status | Details |
|------|--------|---------|
| output/pages/LoginPage.ts | new / updated | {N} methods |
| output/tests/web/scenario.spec.ts | new | {N} test.step blocks |
| output/test-data/web/scenario.json | new | {N} fields |

---

## Locator JSON Usage
| Locator File | Page Object | Keys Used | Keys Available | Coverage |
|-------------|-------------|-----------|----------------|----------|
| login-page.locators.json | LoginPage.ts | 4 | 5 | 80% |
| signup-page.locators.json | SignupPage.ts | 12 | 15 | 80% |

---

## Missing Elements (Scout Gaps)
| Step | Description | Page | Action Needed |
|------|-------------|------|--------------|
| 8 | Click filter icon | FilterPanel | Re-run Scout with filter panel open |
(If none: "All scenario elements found in Scout locator JSONs.")

---

## Self-Audit Results
- Step count match: YES/NO ({scenario} vs {spec})
- VERIFY count match: YES/NO
- CAPTURE count match: YES/NO
- SCREENSHOT count match: YES/NO
- Raw selectors in spec: {N} (target: 0)
- Raw selectors in page objects: {N} (target: 0)

---

## Observability
| Metric | Value |
|--------|-------|
| Duration | ~{N} minutes |
| Pages generated | {N} |
| Methods generated | {N} |
| Locator keys used | {N} of {N} available |
| Token usage | N/A — platform does not expose token counts |
```

---

## Save Location

- With folder: `output/reports/{folder}/builder-report-{scenario}.md`
- Without folder: `output/reports/builder-report-{scenario}.md`
