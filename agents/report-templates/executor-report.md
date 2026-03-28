# Executor Report Template

**Owner:** Executor Agent
**Purpose:** Documents test execution, diagnosis, fixes, and escalated issues. This report feeds into the pipeline summary and Reviewer's test execution gate.

**MANDATORY: Every section MUST be present with actual data. Use "None." for empty sections — NEVER omit a section.**

---

## Template

```markdown
# Executor Report: {scenario}

## Summary
- **Scenario:** {name}
- **Type:** {web | api | hybrid | mobile | mobile-hybrid}
- **Date:** {Month DD, YYYY, HH:MM AM/PM UTC}
- **Duration:** ~{N} minutes
- **Pre-flight issues found:** {N} (fixed before Cycle 1)
- **Total cycles:** {N} of 3 max
- **Final status:** PASSING / FAILING
- **Tests passed:** {N}/{total}
- **Escalated issues:** {N}

---

## Pre-Flight Fidelity Audit

### TypeScript Check
- Command: `cd output && npx tsc --noEmit`
- Result: {PASS | {N} errors found and fixed}
- Fixes: {list each fix, or "None needed"}

### Step Count Verification
- Source scenario steps: {N}
- Spec test.step() calls: {N}
- Match: {YES | NO — {N} gaps fixed}
- Fixes: {list each missing step added, or "None needed"}

### Keyword Spot-Check
- VERIFY → expect(): {PASS / {N} issues}
- VERIFY_SOFT → expect.soft(): {PASS / {N} issues}
- CAPTURE variables in outer scope: {PASS / {N} issues}
- Tags with @ prefix: {PASS / {N} issues}
- API calls use request fixture: {PASS / {N} issues}
- Pre-flight fixes applied: {total count}

---

## Environment Setup
| Check | Status | Notes |
|-------|--------|-------|
| .env file exists | PASS/FAIL | {path or error} |
| npm dependencies | PASS/FAIL | {installed / missing} |
| Playwright browsers | PASS/FAIL | {chromium installed} |
| tsc --noEmit | PASS/FAIL | {N} errors or clean |

---

## Cycle History

### Cycle 1
- **Command:** `cd output && npx playwright test tests/{type}/[{folder}/]{scenario}.spec.ts --project=chrome --reporter=json,list`
- **Result:** {N} passed, {N} failed, {N} skipped
- **Duration:** ~{N}s

#### Failures (Cycle 1)
| Step | Error | Diagnostic Gate | Diagnosis |
|------|-------|----------------|-----------|
| Step 5 | Timeout waiting for .grid-row | Element present in DOM → Interaction Pacing | Grid loads asynchronously |
| Step 12 | expect(received).toBe(expected) | Element present, value read correct → POTENTIAL BUG | Expected "2", found "3" |

#### Fixes Applied (Cycle 1)
| # | File | Change | Category | Reason |
|---|------|--------|----------|--------|
| 1 | pages/DashboardPage.ts:42 | Added waitForSelector('.grid-row', {state:'visible'}) | Pacing | Async grid loading after navigation |
| 2 | — | test.fixme('POTENTIAL BUG: expected "2" found "3"') | Escalated | Value mismatch — not a test issue |

#### Same-Root-Cause Check: N/A (first cycle)

---

### Cycle 2
- **Result:** {N} passed, {N} failed
- **Same-root-cause check:** {Different from Cycle 1 / Same as Cycle 1 → {action taken}}
- **Failures:** {list or "None — all tests passing"}
- **Fixes applied:** {list or "None"}

---

### Cycle 3 (if needed)
- **Result:** {N} passed, {N} failed
- **Same-root-cause check:** {result}
- If still failing → **STOPPED — max cycles reached**
- Remaining failures marked: test.fixme('UNFIXABLE: [root cause] persisted across {N} cycles')

---

## Final Test Results
- **Passed:** {N}
- **Failed:** {N}
- **Skipped:** {N}
- **test.fixme (blocked):** {N}
- **Duration:** ~{N}s
- **Status:** PASSING / FAILING

---

## Fixes Summary
| # | File | Line | Change | Category | Reason |
|---|------|------|--------|----------|--------|
| 1 | pages/DashboardPage.ts | 42 | Added waitForSelector | Pacing | Async grid |
| 2 | tests/web/scenario.spec.ts | 78 | Added await | Code fix | Missing await on async call |
[List ALL fixes across all cycles, or "No fixes needed — tests passed on first run."]

---

## Escalated Issues (Not Fixed)

### Potential Application Bugs
| Test Step | Signal | Expected | Actual | Marker |
|-----------|--------|----------|--------|--------|
| Step 12 | Assertion failed, element found, correct read | "2" | "3" | test.fixme('POTENTIAL BUG: ...') |
[Or "None — no potential bugs detected."]

### Unfixable Issues
| Test Step | Root Cause | Cycles Attempted | Marker |
|-----------|-----------|-----------------|--------|
| Step 8 | Element not in DOM — needs Explorer-Builder re-exploration | 2 | test.fixme('UNFIXABLE: ...') |
[Or "None."]

### Helper Method Issues
| Test Step | Helper File | Method | Error | Marker |
|-----------|------------|--------|-------|--------|
| Step 15 | CartPage.helpers.ts | calculateTotal | TypeError: not a function | test.fixme('HELPER ISSUE: ...') |
[Or "None — no helper issues."]

---

## Screenshots Captured
| Step | Name | Attached to Test |
|------|------|-----------------|
| Step 4 | after-login | Yes |
| Step 10 | filter-applied | Yes |
[List all screenshots captured during execution, or "No screenshots captured."]

---

## App-Context Check (MANDATORY)
- [ ] PACING comments added during fix cycles? {Y/N}
- [ ] App-context file exists for this app? {Y/N}
- [ ] If PACING=Y and app-context=N → **CREATED app-context file**
- [ ] If PACING=Y and app-context=Y → **UPDATED app-context file**
- [ ] New patterns written: {list, or "None"}

---

## Summary Metrics
| Metric | Value |
|--------|-------|
| Total tests | {N} |
| Passed | {N} |
| Failed | {N} |
| test.fixme (blocked) | {N} |
| Fix cycles used | {N} of 3 |
| Pre-flight fixes | {N} |
| Runtime fixes | {N} |
| Escalated issues | {N} |
| App-context updated | {Yes/No} |
| Final status | PASSING / FAILING |

## Observability
| Metric | Value |
|--------|-------|
| Tokens used | {N} |
| Context window | {N}% |
| Duration | ~{N} minutes |
| Tokens per cycle | ~{N} average |

## Eval Metrics
| Metric | Value |
|--------|-------|
| Pre-flight catch rate | {N} issues caught before Cycle 1 |
| First-run pass rate | {N}% (Cycle 1 pass / total tests) |
| Fix success rate | {N}% (fixes that resolved their target failure) |
| Cycle efficiency | {N} cycles used of 3 max |
| Escalation rate | {N}% (escalated issues / total failures) |
| Same-root-cause detections | {N} |
```

---

## Save Location

- With folder: `output/reports/{folder}/executor-report-{scenario}.md`
- Without folder: `output/reports/executor-report-{scenario}.md`

## Sections That MUST Always Be Present

| Section | Empty-State Phrase |
|---------|-------------------|
| Pre-Flight Audit | "All checks passed — no pre-flight issues." |
| Cycle History | "Cycle 1: All tests passed on first run — no fix cycles needed." |
| Fixes Summary | "No fixes needed — tests passed on first run." |
| Potential Bugs | "None — no potential bugs detected." |
| Unfixable Issues | "None." |
| Helper Method Issues | "None — no helper issues." |
| Screenshots Captured | "No screenshots captured." |
| App-Context Check | Must always be filled (Y/N checkboxes) |
