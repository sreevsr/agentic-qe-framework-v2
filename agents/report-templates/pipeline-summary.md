# Pipeline Summary Report Standard

**Version:** 2.0
**Owner:** Orchestrator / Pipeline Coordinator
**Purpose:** Defines the MANDATORY format for all pipeline summary reports. Ensures consistency, completeness, and audit-ready documentation.

---

## MANDATORY: Every pipeline summary MUST include ALL sections below with ACTUAL data. NO placeholders. NO generic text.

---

## Template

```markdown
# QE Pipeline Summary

**Scenario:** {scenario-name}
**Type:** {web | api | hybrid | mobile | mobile-hybrid}
**Folder:** {folder-name | N/A}
**Date:** {Month DD, YYYY, HH:MM AM/PM UTC}
**Pipeline Duration:** ~{N} minutes
**Pipeline:** [Enrichment Agent] → Explorer/Builder → Executor → Reviewer [→ Healer]
**Final Verdict:** APPROVED / APPROVED WITH CAVEATS / NEEDS FIXES / TESTS FAILING / INCOMPLETE
**Test Results:** {N}/{total} passing ({N} failed, {N} test.fixme) — execution time ~{N}s
**Quality Score:** {N}/{M} ({N}% — Reviewer verdict: {verdict})
**Exploration:** {N}/{total} steps verified across {N} pages, {N} chunks
**Executor Fixes:** {N} fixes in {N} cycles ({list top fix categories, e.g., "2 timing, 1 selector, 1 scroll"})

---

## 1. Pipeline Results

| Stage | Agent | Status | Duration | Notes |
|-------|-------|--------|----------|-------|
| 0 | Enrichment Agent | SKIPPED / COMPLETED | ~{N}min | {Passthrough / Enriched from NL / Swagger spec} |
| 1 | Explorer/Builder | COMPLETED / PARTIAL | ~{N}min | {N} steps explored, {N} pages, {N} first-try, {N} blocked |
| 2 | Executor | COMPLETED / FAILING | ~{N}min | {N} cycles, {N} pre-flight fixes, {N} runtime fixes |
| 3 | Reviewer | COMPLETED | ~{N}min | Score: {N}/{M}, Verdict: {APPROVED / NEEDS FIXES / TESTS FAILING} |

---

## 2. Final Verdict

**{APPROVED / NEEDS FIXES / TESTS FAILING}**

{1-2 sentence summary justifying the verdict. Reference specific dimension scores or test failures.}

---

## 3. Files Generated

### Config & Core (reused from setup.js)
| File | Status |
|------|--------|
| output/playwright.config.ts | reused |
| output/core/base-page.ts | reused |
| output/core/locator-loader.ts | reused |

### Locators
| File | Status | Elements |
|------|--------|----------|
| output/locators/{page}.locators.json | new | {N} elements |

### Page Objects
| File | Status | Methods |
|------|--------|---------|
| output/pages/{Page}Page.ts | new / reused | {N} methods |

### Test Spec
| File | Scenarios | Steps |
|------|-----------|-------|
| output/tests/{type}/[{folder}/]{scenario}.spec.ts | {N} | {N} |

### Test Data
| File | Status |
|------|--------|
| output/test-data/{type}/{scenario}.json | new |
| output/test-data/shared/{dataset}.json | reused |

### Reports
| File | Agent |
|------|-------|
| output/reports/explorer-report-{scenario}.md | Explorer/Builder |
| output/reports/executor-report-{scenario}.md | Executor |
| output/reports/review-scorecard-{scenario}.md | Reviewer |
| output/reports/metrics/explorer-metrics-{scenario}.json | Explorer/Builder |
| output/reports/metrics/executor-metrics-{scenario}.json | Executor |

---

## 4. Test Execution Summary

- **Total Scenarios:** {N}
- **Scenarios Passed:** {N} ({X}%)
- **Scenarios Failed:** {N}
- **Total Steps:** {N} (including lifecycle hooks)
- **Steps Verified (Explorer):** {N}/{total} ({N} first-try, {N} retried, {N} blocked)
- **Executor Fix Cycles:** {N} of 3 max
- **Pre-Flight Fixes:** {N} (TypeScript errors, missing steps)
- **Final Test Status:** {N}/{N} passing (execution time: ~{N} seconds)

---

## 5. Quality Metrics

### Dimension Scores

| # | Dimension | Weight | Score | Key Finding |
|---|-----------|--------|-------|-------------|
| 1 | Locator Quality | High | {N}/5 | {specific finding} |
| 2 | Wait Strategy | High | {N}/5 | {specific finding} |
| 3 | Test Architecture | Medium | {N}/5 | {specific finding} |
| 4 | Configuration | Medium | {N}/5 | {specific finding} |
| 5 | Code Quality | Low | {N}/5 | {specific finding} |
| 6 | Maintainability | Medium | {N}/5 | {specific finding} |
| 7 | Security | High | {N}/5 | {specific finding} |
| 8 | API Test Quality | Medium | {N}/5 or N/A | {specific finding} |
| 9 | Fidelity | **HIGH** | {N}/5 | {specific finding} |
| | **Overall** | | **{N}/{M}** | **{verdict}** |

### Fidelity Summary
Source steps: {N} | Spec test.step() calls: {N} | Match: {YES/NO}
Blocked steps (test.fixme): {N}
VERIFY: {N}/{N} | VERIFY_SOFT: {N}/{N} | CAPTURE: {N}/{N}
SCREENSHOT: {N}/{N} | REPORT: {N}/{N} | SAVE: {N}/{N}
CALCULATE: {N}/{N} | API steps: {N}/{N}
Lifecycle hooks: beforeAll={Y/N/NA} beforeEach={Y/N/NA} afterEach={Y/N/NA} afterAll={Y/N/NA}

---

## 6. Critical Fixes Applied

### Explorer/Builder Discoveries
1. {Component/pattern discovered — e.g., "PCF grid filter icons are SVG, not IMG"}
2. {Interaction fix — e.g., "Filter input requires pressSequentially instead of fill"}

### Executor Fixes
1. {File}: {Change} — {Reason}
2. {File}: {Change} — {Reason}

### Escalated Issues (Not Fixed)
- {test.fixme markers: POTENTIAL BUG / UNFIXABLE / HELPER ISSUE / SCENARIO BLOCKED}
- {Or "None — all steps verified and passing"}

---

## 7. App-Context Updates

- App-context file: {scenarios/app-contexts/{app}.md}
- Patterns added: {N}
- Details: {list each new pattern, or "No new patterns discovered"}

---

## 8. Test Execution Commands

```bash
# Run this specific scenario
cd output && npx playwright test tests/{type}/[{folder}/]{scenario}.spec.ts --project=chrome

# Run with HTML report
cd output && npx playwright test tests/{type}/[{folder}/]{scenario}.spec.ts --project=chrome --reporter=html

# Run headed (visible browser)
cd output && npx playwright test tests/{type}/[{folder}/]{scenario}.spec.ts --project=chrome --headed

# Run with tag filter
cd output && npx playwright test --grep @{tag} --project=chrome
```

---

## 9. Agent Performance & Observability

**Data source:** `output/reports/metrics/explorer-metrics-{scenario}.json`, `executor-metrics-{scenario}.json`, `scripts/explorer-post-check.js` output

### Stage Duration
| Agent | Duration | Notes |
|-------|----------|-------|
| Enrichment Agent | ~{N}min / SKIPPED | {notes} |
| Explorer/Builder | ~{N}min | {N} chunks, {N} subagents spawned |
| Executor | ~{N}min | {N} cycles, {N} test executions |
| Reviewer | ~{N}min | {N} dimensions scored |
| **Total Pipeline** | **~{N}min** | |

**Token usage:** N/A — platform does not expose token counts. Do NOT estimate or fabricate token numbers.

### Agent Eval Metrics
| Metric | Value | Source |
|--------|-------|--------|
| First-run pass rate | {N}% (Executor Cycle 1 pass/total) | Executor report |
| Exploration accuracy | {N}% (steps verified first-try / total steps) | Explorer report |
| Fix cycle efficiency | {N} cycles used of {max} max | Executor report |
| Self-improvement | {N} app-context patterns added | Explorer + Executor reports |
| Subagents spawned | {N} | Orchestrator invocation count |
| Quality score | {N}/{M} ({verdict}) | Reviewer scorecard |
| Locator elements (verified) | {N} across {N} files | `explorer-post-check.js` |
| Step count match | {scenario} vs {spec} — {MATCH/MISMATCH} | `explorer-post-check.js` |

---

## 10. Key Technical Achievements

- {Specific achievement — e.g., "32/32 steps verified on first attempt — zero retries needed"}
- {Specific achievement — e.g., "Microsoft SSO redirect chain handled: /Experts/ → /SMEInsights/?page=National"}
- {Specific achievement — e.g., "3 new app-context patterns discovered and persisted for future runs"}
- {Specific achievement — e.g., "PCF grid interaction patterns (SVG icons, pressSequentially) now in app-context"}
```

---

## Data Sources — Where to Get the Numbers

**MANDATORY: The Orchestrator MUST read these files to populate the summary:**

| Section | Source File(s) | What to Extract |
|---------|---------------|-----------------|
| Pipeline Results | All agent reports + metrics | Stage status, duration, notes |
| Test Execution Summary | Explorer report + Executor report + scenario .md | Step counts, pass/fail, cycles |
| Quality Metrics | Review scorecard | All 9 dimension scores, verdict |
| Critical Fixes | Explorer report (discoveries) + Executor report (fixes) | Pattern discoveries, code fixes |
| App-Context Updates | Explorer report + Executor report | New patterns written |
| Files Generated | Explorer report (Files Generated section) | All created/reused files |
| Agent Performance | `output/reports/metrics/*-metrics-*.json` + `explorer-post-check.js` output | Duration, subagent count, verified counts (NO token estimates) |
| Key Achievements | All reports + scenario .md | Scenario-specific highlights |

---

## Quality Checklist — MANDATORY Before Saving

- [ ] Timestamp includes time zone (e.g., "March 28, 2026, 10:30 AM UTC")
- [ ] Duration estimated in minutes
- [ ] ALL {placeholders} replaced with actual values — ZERO placeholders remaining
- [ ] Dimension Scores table has all 9 rows (or N/A where applicable) with numbers
- [ ] Fidelity Summary has actual step/keyword counts
- [ ] Critical Fixes section has numbered items with file paths (or "None")
- [ ] Test Execution Summary has quantitative metrics (not generic text)
- [ ] Files Generated section has (new), (reused), or (updated) status per file
- [ ] Key Technical Achievements has 3-6 specific items (not generic)
- [ ] Test commands are accurate for the scenario path

---

## Good vs Bad Examples

### BAD — DO NOT USE:
```markdown
## Test Execution Summary
- **Total Scenarios:** {N}
- **Duration:** {total time}
- **Status:** Tests are passing
```

### GOOD — USE THIS:
```markdown
## Test Execution Summary
- **Total Scenarios:** 4
- **Scenarios Passed:** 4 (100%)
- **Total Steps:** 31 (including Common Setup)
- **Executor Fix Cycles:** 1 (added waitForSelector for async grid)
- **Final Test Status:** 4/4 passing (execution time: ~22 seconds)
```

---

## Save Location

- With folder: `output/reports/{folder}/pipeline-summary-{scenario}.md`
- Without folder: `output/reports/pipeline-summary-{scenario}.md`

**Target length:** 140+ lines with actual data. Professional, audit-ready quality.
