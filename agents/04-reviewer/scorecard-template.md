# Scorecard Template

Generate the scorecard in this format:

```markdown
# QE Review Scorecard
**Date:** [Month DD, YYYY, HH:MM AM/PM UTC]
**Framework:** [output/ directory]
**Overall Score:** [total]/45

| # | Dimension | Weight | Score | Key Finding |
|---|-----------|--------|-------|-------------|
| 1 | Locator Quality | High | _/5 | ... |
| 2 | Wait Strategy | High | _/5 | ... |
| 3 | Test Architecture | Medium | _/5 | ... |
| 4 | Configuration | Medium | _/5 | ... |
| 5 | Code Quality | Low | _/5 | ... |
| 6 | Maintainability | Medium | _/5 | ... |
| 7 | Security | High | _/5 | ... |
| 8 | API Test Quality | Medium | _/5 | ... (or N/A if no API tests) |
| 9 | Scenario-to-Code Fidelity | **HIGH** | _/5 | ... |

## Scenario-to-Code Fidelity Summary
Source steps: [N] | Spec STEP comments: [N] | Match: YES/NO
VERIFY: [N]/[N] | VERIFY_SOFT: [N]/[N] | CAPTURE: [N]/[N] | SCREENSHOT: [N]/[N]
REPORT: [N]/[N] | SAVE: [N]/[N] | CALCULATE: [N]/[N] | API steps: [N]/[N]
Lifecycle hooks: beforeAll=[Y/N/NA] beforeEach=[Y/N/NA] afterEach=[Y/N/NA] afterAll=[Y/N/NA]
Missing or incorrect items: [list each, or "None"]

## Critical Issues (must fix)
1. ...

## Recommendations (nice to have)
1. ...

## Verdict: [APPROVED / NEEDS FIXES]
```

**Verdict criteria:**
- **APPROVED**: Score >= 80% of applicable total AND no dimension below 3 AND Dimension 9 (Scenario-to-Code Fidelity) >= 4
- **NEEDS FIXES**: Score < 80% OR any dimension below 3 OR Dimension 9 below 4 — list exact fixes required

**N/A dimensions:** When a dimension does not apply to the scenario type (e.g., Dimension 8 "API Test Quality" for a pure web scenario), mark it N/A and reduce the denominator. For example: 9 dimensions = 45 max. If 1 dimension is N/A, the max is 40 and the 80% threshold is 32/40. Always show the adjusted denominator in the Overall Score (e.g., "35/40") and state which dimension is N/A.

**Dimension 9 is the hard gate.** A test framework that scores 5/5 on all other dimensions but drops scenario steps or misses assertions is NOT approved. Fidelity to the scenario is non-negotiable.

Save the review scorecard:
- With folder: `output/{folder}/review-scorecard-{scenario}.md`
- Without folder: `output/review-scorecard-{scenario}.md`

## Report Self-Validation

Before saving, verify your scorecard contains ALL of these with actual data (no placeholders):
1. **Date** — with UTC time (Month DD, YYYY, HH:MM AM/PM UTC)
2. **All 9 dimension scores** — each with a numeric score and specific key finding
3. **Overall score** — actual sum out of 45
4. **Scenario-to-Code Fidelity Summary** — actual step counts and keyword counts from the source scenario vs the spec
5. **Critical Issues** — specific file paths and line references for each issue (or "None")
6. **Verdict** — APPROVED or NEEDS FIXES with clear justification

**Do NOT use generic findings like "Good" or "No issues".** Each dimension must cite specific files and evidence examined.
