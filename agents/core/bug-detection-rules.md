# Bug Detection Rules — Explorer-Builder Reference

**MANDATORY: The Explorer-Builder MUST read this file as part of pre-flight. MUST apply these rules after EVERY interaction during exploration. DO NOT skip this. DO NOT guess — follow the questions and tables.**

---

## The Core Principle

**The Explorer-Builder fixes HOW it interacts with the application. It NEVER changes WHAT the application should do.**

- **HOW** = selectors, timing, interaction method, wait strategies → test infrastructure → **ADAPT**
- **WHAT** = expected outcomes, values, behavior, business logic → application concern → **FLAG AS BUG**

**If you are unsure which category something falls into → FLAG, not ADAPT. False positives (flagging something that isn't a bug) are far less harmful than false negatives (hiding a real bug).**

---

## The 3-Question Decision Gate — MANDATORY After Every Interaction

**HARD STOP: After EVERY interaction attempt, you MUST ask these 3 questions IN ORDER. DO NOT skip questions. DO NOT jump ahead.**

### QUESTION 1: Did the interaction EXECUTE?

Did the element get found AND did the action complete (click registered, text entered, option selected)?

- **NO** → STOP. Go to **TABLE A** below.
- **YES** → Go to **QUESTION 2**.

### QUESTION 2: Did the EXPECTED OUTCOME occur?

After the action, did the page respond as the scenario step implies? (page navigated, content updated, confirmation shown, value changed)

- **YES** → **PROCEED** — interaction verified. Write code. Move to next step.
- **NO** → Go to **QUESTION 3**.

### QUESTION 3: Is the unexpected outcome a TEST issue or an APP issue?

Look at what ACTUALLY happened. Compare against what SHOULD have happened per the scenario.

- Go to **TABLE B** below to classify.

---

## TABLE A — Interaction Failure Diagnosis

**MUST read top-to-bottom. Apply the FIRST matching row.**

| # | Situation | Signal | Verdict | Action |
|---|-----------|--------|---------|--------|
| A1 | Element in DOM but first selector didn't match | Different attribute/structure than expected | **ADAPT** | Try fallback selectors from locator JSON |
| A2 | Element in DOM but not yet visible/actionable | Timeout waiting for visibility | **ADAPT** | Add `waitForSelector({state:'visible'})` |
| A3 | Element blocked by overlay/banner/toast | Click intercepted by another element | **ADAPT** | Dismiss overlay per quality-gates.md Section 5, retry |
| A4 | Element in DOM but in an iframe | Element not in main frame | **ADAPT** | Use `frameLocator()` to enter iframe |
| A5 | Element not in DOM — browser on WRONG page | URL doesn't match expected page | **ADAPT** | Fix navigation — go to correct page, retry |
| A6 | Element not in DOM — browser on RIGHT page | URL correct, element genuinely absent | **FLAG** | `test.fixme('POTENTIAL BUG: {element} not found on {page} — expected per scenario step {N}')` |
| A7 | Element exists but is DISABLED | `disabled` attribute or `aria-disabled="true"` | **FLAG** | `test.fixme('POTENTIAL BUG: {element} is disabled — scenario expects it to be actionable. May need prerequisite data or form validation.')` |
| A8 | Element exists but is HIDDEN (display:none) | `is_visible()` returns false persistently | **FLAG** | `test.fixme('POTENTIAL BUG: {element} exists in DOM but is hidden — scenario expects it visible')` |
| A9 | fill() doesn't trigger expected events | Input accepts text but no filter/search activates | **ADAPT** | Try `pressSequentially(value, {delay: 100})` instead |
| A10 | None of the above | Unclassifiable interaction failure | **UNCERTAIN** | `test.fixme('UNCERTAIN: {element} interaction failed — {details}. Needs human review.')` |

---

## TABLE B — Outcome Classification

**The interaction EXECUTED but the OUTCOME is NOT what the scenario expected. MUST read top-to-bottom. Apply the FIRST matching row.**

| # | Situation | Signal | Verdict | Action |
|---|-----------|--------|---------|--------|
| B1 | Page navigated to WRONG destination | URL is `/error` or unexpected page after action | **FLAG** | `test.fixme('POTENTIAL BUG: {action} navigated to {actual_url} instead of expected {expected_page}')` |
| B2 | VERIFY step: element found, value WRONG | Expected "2", actual "3" | **FLAG** | `test.fixme('POTENTIAL BUG: expected "{expected}" but found "{actual}" in {element}')` MUST NOT change expected value |
| B3 | Action succeeded but NO visible change | Clicked button, nothing happened on page | **FLAG** | `test.fixme('POTENTIAL BUG: {action} produced no visible response — no navigation, no content update, no confirmation')` |
| B4 | Action succeeded but ERROR message shown | Toast/alert with error text after expected-success action | **FLAG** | `test.fixme('POTENTIAL BUG: {action} shows error "{error_text}" — scenario expects success')` |
| B5 | API returned success but UI doesn't reflect | POST returned 201 but UI still shows old data | **FLAG** | `test.fixme('POTENTIAL BUG: API returned {status} but UI does not reflect the change')` |
| B6 | Element present but EMPTY | Price label visible but shows "" or "$0.00" | **FLAG** | `test.fixme('POTENTIAL BUG: {element} is present but empty — expected a value')` |
| B7 | Page crashed or shows server error | White screen, stack trace, 500/503 | **FLAG** | `test.fixme('APP ERROR: Page shows {error_type} after {action}')` |
| B8 | Unexpected dialog appeared | "Session expired", "Error occurred", unhandled alert | **FLAG** | `test.fixme('APP ERROR: Unexpected dialog "{dialog_text}" during step {N}')` |
| B9 | Action succeeded but took very long | Eventually worked after extended wait | **ADAPT** | Add `// PACING:` wait. Update app-context with timing info |
| B10 | Page content partially loaded | Some elements rendered, others missing/loading | **ADAPT** | Add `waitForLoadState('networkidle')` or `waitForFunction()` for specific content |
| B11 | None of the above | Unclassifiable outcome mismatch | **UNCERTAIN** | `test.fixme('UNCERTAIN: Expected {expected_outcome} after {action} but got {actual_outcome}. Needs human review.')` |

---

## Discovered Steps — Expected Outcomes — HARD RULE

**When the Explorer-Builder DISCOVERS new steps not in the original scenario, it MUST assume the SUCCESS path for expected outcomes.**

| Explorer Discovers | Default Expected Outcome | If Actual Differs |
|-------------------|-------------------------|-------------------|
| Form has 5 fields | All fields accept valid test data | FLAG any field that rejects valid input |
| Dropdown has options | Selecting an option works and updates the form | FLAG if empty or selection fails |
| Navigation leads to new page | Page loads with relevant content | FLAG if error page or empty |
| Confirmation dialog appears | Dialog shows success | FLAG if shows error |
| New screen after action | Screen contains expected data | FLAG if wrong data or empty |

**HARD STOP: The Explorer-Builder MUST NEVER assume failure is the expected outcome.** If checkout fails with "Payment declined":

**CORRECT:**
```
VERIFY: Order confirmation page displayed
test.fixme('POTENTIAL BUG: Checkout shows "Payment declined" instead of order confirmation')
```

**WRONG — NEVER DO THIS:**
```
VERIFY: Payment declined message displayed   ← ASSUMES FAILURE IS CORRECT
```

---

## Environment vs Application Issue

**Before flagging as APP bug, check if the issue is environmental:**

| Signal | Environment Issue (ADAPT) | App Bug (FLAG) |
|--------|--------------------------|----------------|
| Fails on first attempt, works on retry | YES — cold start/cache | NO |
| Fails consistently on every attempt | NO | YES |
| Timeout that resolves with longer wait | YES — slow environment | NO |
| Error references server/infra ("503", "ECONNREFUSED") | YES — infra issue | MAYBE — report as APP ERROR with caveat |
| Error references business logic ("Invalid card", "User not found") | NO | YES |
| ALL pages fail | YES — environment is down | NO — stop exploration, report ENV issue |
| Only THIS page/feature fails, others work | NO | YES — page-specific bug |

---

## Anti-Patterns — MUST NEVER Do These

| # | Anti-Pattern | Why It's Wrong | Correct Action |
|---|-------------|----------------|----------------|
| 1 | **Change expected value to match actual** | Masks data bugs — app shows wrong value, test says "fine" | FLAG as POTENTIAL BUG, keep original expected value |
| 2 | **Take an alternative flow** | Scenario says "click Submit", it's disabled, agent clicks "Save Draft" | FLAG disabled Submit, DO NOT take alternative path |
| 3 | **Use force:true on disabled element** | Bypasses intentional app logic | FLAG as POTENTIAL BUG |
| 4 | **Skip a step silently** | Hides failure, cascades downstream | FLAG with test.fixme, CONTINUE to next step |
| 5 | **Invent failure as expected outcome** | "VERIFY: Error shown" on a broken checkout → test passes on broken app | Expected outcomes for discovered steps MUST be success path |
| 6 | **Retry indefinitely** | Element may never appear if app is broken | Max attempts from `framework-config.json`, then FLAG |
| 7 | **Assume the app is right when scenario disagrees** | "App shows 3 but scenario says 2 — app must be right" — NO | The SCENARIO is the specification. If app disagrees → FLAG |

---

## Configuration

**Read `framework-config.json` for configurable values:**
- `exploration.maxAttemptsPerStep` — retries per step before test.fixme (default: 3)
- `exploration.interactionTimeoutMs` — how long to wait for an interaction to complete (default: 30000)
- `bugDetection.uncertainVerdictEnabled` — allow UNCERTAIN verdict (default: true)

**DO NOT use hardcoded retry counts or timeouts. Read from config.**

---

## Adding New Rules

As new situations are discovered during framework usage, add rows to TABLE A or TABLE B. Each row is independent — adding a new row does NOT affect existing logic. Use the next available number (A11, B12, etc.).
