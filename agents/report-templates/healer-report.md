# Healer Report Template

**Owner:** Healer Agent
**Purpose:** Documents code quality fixes applied after a NEEDS FIXES verdict from the Reviewer. Tracks what was fixed, what remains, and whether tests still pass after changes.

**MANDATORY when Healer is invoked (Reviewer verdict = NEEDS FIXES). NOT required when Reviewer verdict is APPROVED or TESTS FAILING.**

---

## MANDATORY Header Fields — HARD STOP

**The first 4 fields below (Scenario, Type, Date, Pipeline Stage) are the STANDARD REPORT HEADER. ALL agent reports MUST include these 4 fields with actual values. This is non-negotiable — reports without Date or Pipeline Stage are incomplete.**

## Template

```markdown
# Healer Report: {scenario}

**Scenario:** {name}
**Type:** {web | api | hybrid | mobile | mobile-hybrid}
**Date:** {Month DD, YYYY, HH:MM AM/PM UTC}
**Pipeline Stage:** Stage 4 — Healer (post-Reviewer)
**Duration:** {N}m {N}s (computed from startTime → endTime in metrics JSON)
**Outcome:** PASSING / FAILING (after fixes)
**Scorecard Input:** {score}/{max} — verdict: NEEDS FIXES
**Issues Fixed:** {N}/{total} ({N} critical, {N} recommendations) — {N} remaining
**Score Impact:** {before}/{max} → {after}/{max} (+{delta} points)
**Fix Cycles:** {N} of 2 max — {N} test executions
**Regression:** None / Yes (details)
**Key Fixes:** {1-line summary, e.g., "Replaced 4 raw selectors with LocatorLoader, added 2 missing fallbacks"}

---

## Source Files Read
| File | Path | Status |
|------|------|--------|
| Scorecard | {path} | Read |
| Spec file | {path} | Read |
| Scenario | {path} | Read |
| Explorer report | {path} | Read / Not found |
| Executor report | {path} | Read / Not found |

---

## Fixes Applied
| # | Dimension | Issue | File | Line | Change Summary | Verified |
|---|-----------|-------|------|------|----------------|----------|
| 1 | Dim 1 | Raw selector in CartPage | output/pages/CartPage.ts | 12 | Replaced page.locator('#cart') with this.loc.getLocator('cartTable') | YES |
| 2 | ... | ... | ... | ... | ... | ... |

---

## Issues Not Fixed
| # | Dimension | Issue | Reason |
|---|-----------|-------|--------|
| 1 | Dim 9 | REPORT steps use static labels | Guardrail: cannot change step intent |
| 2 | ... | ... | ... |

(If none: "All scorecard issues were addressed.")

---

## Test Execution After Fixes
- **Cycle 1:** {N} passed, {N} failed — {summary of failures if any}
- **Cycle 2:** {N} passed, {N} failed — {summary} (only if Cycle 1 had failures)
- **Final:** {N}/{N} passing

---

## Files Modified
| File | Changes |
|------|---------|
| output/pages/CartPage.ts | Replaced 4 raw selectors with LocatorLoader |
| output/locators/cart-page.locators.json | Added missing fallbacks for 2 elements |
| ... | ... |

---

## Scoring — Before vs After
| Dimension | Before (from scorecard) | After (post-fix estimate) | Delta |
|-----------|------------------------|---------------------------|-------|
| 1 — Locator Quality | {N}/5 | {N}/5 | +{N} |
| 2 — Wait Strategy | {N}/5 | {N}/5 | +{N} |
| 3 — Test Architecture | {N}/5 | {N}/5 | +{N} |
| 4 — Configuration | {N}/5 | {N}/5 | +{N} |
| 5 — Code Quality | {N}/5 | {N}/5 | +{N} |
| 6 — Maintainability | {N}/5 | {N}/5 | +{N} |
| 7 — Security | {N}/5 | {N}/5 | +{N} |
| 8 — API Quality | {N}/5 or N/A | {N}/5 or N/A | +{N} |
| 9 — Fidelity | {N}/5 | {N}/5 | +{N} |
| **Overall** | **{N}/{max}** | **{N}/{max}** | **+{N}** |

---

## Observability
| Metric | Value |
|--------|-------|
| Duration | {N}m {N}s |
| Files examined | {N} |
| Files modified | {N} |
| Fix cycles run | {N} of 2 max |
| Token usage | N/A — platform does not expose token counts |

---

## Eval Metrics
| Metric | Value |
|--------|-------|
| Issues received from scorecard | {N} |
| Critical issues received | {N} |
| Recommendations received | {N} |
| Issues fixed | {N} |
| Fix rate | {N}% |
| Issues remaining | {N} |
| Fix cycles used | {N} of 2 |
| Tests passing after fix | {N}/{N} |
| Regression introduced | {Yes (details) / No} |
```

---

## Save Location

- With folder: `output/reports/{folder}/healer-report-{scenario}.md`
- Without folder: `output/reports/healer-report-{scenario}.md`

## Sections That MUST Always Be Present

| Section | Empty-State Phrase |
|---------|-------------------|
| Fixes Applied | "No fixes applied — all issues were non-actionable." |
| Issues Not Fixed | "All scorecard issues were addressed." |
| Test Execution | Must always have at least Cycle 1 results |
| Files Modified | "No files modified." |
| Scoring | Must always have Before/After numbers |
| Observability | MUST always be populated — include Duration, Files examined, Files modified, Fix cycles |
| Eval Metrics | MUST always be populated — include Issues received, Fix rate, Tests passing after fix, Regression status |
