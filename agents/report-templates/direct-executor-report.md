# Direct Executor Report Template

**Use this template EXACTLY. Fill in every field. No placeholders.**

---

```markdown
# Direct Execution Report: {scenario-name}

## Summary
| Metric | Value |
|--------|-------|
| Scenario | {scenario-name} |
| Date | {YYYY-MM-DD HH:MM:SS} |
| Total Steps | {N} |
| Passed | {N} |
| Failed | {N} |
| Skipped | {N} |
| Pass Rate | {N}% |
| Total Time | {N}s |
| Avg Time/Step | {N}ms |
| Self-Heals | {N} (attempts that recovered) |
| Screenshots | {N} |
| Verdict | **PASS** or **FAIL** |

## Environment
| Variable | Value |
|----------|-------|
| BASE_URL | {value} |
| SIGNUP_EMAIL | {generated value} |
| Browser | Chromium (MCP Playwright) |

## Step Results

| # | Section | Step | Type | Result | Time | Notes |
|---|---------|------|------|--------|------|-------|
| 1 | Signup Flow | Navigate to BASE_URL | NAVIGATE | PASS | 1200ms | |
| 2 | Signup Flow | Click "Signup / Login" | ACTION | PASS | 800ms | |
| ... | ... | ... | ... | ... | ... | ... |

## Failed Steps Detail

### Step {N}: {step text}
- **Type:** {type}
- **Expected:** {what should have happened}
- **Actual:** {what happened}
- **Self-heal attempts:** {N}
  - Attempt 1: {what was tried} → {result}
  - Attempt 2: {what was tried} → {result}
  - Attempt 3: {what was tried} → {result}
- **Screenshot:** {filename if taken}

## Captured Variables

| Variable | Value | Step |
|----------|-------|------|
| blueTopPrice | Rs. 500 | Step 18 |
| menTshirtPrice | Rs. 400 | Step 23 |
| ... | ... | ... |

## Self-Healing Log

| Step | Attempt | Action | Result |
|------|---------|--------|--------|
| {N} | 1 | {tried exact match} | FAIL |
| {N} | 2 | {tried scroll + retry} | PASS |

## Screenshots

| Name | Step | File |
|------|------|------|
| account-created | 14 | account-created.png |
| cart-with-all-items | 45 | cart-with-all-items.png |

## Observations

{Any patterns noticed, unexpected behaviors, popup/ad handling, timing issues.
These observations inform future optimization decisions.}

## Timing Breakdown

| Phase | Time |
|-------|------|
| Pre-flight (read scenario + env) | {N}ms |
| Step classification | {N}ms |
| Browser navigation | {N}ms |
| ACTION steps total | {N}ms |
| VERIFY steps total | {N}ms |
| CAPTURE steps total | {N}ms |
| SCREENSHOT steps total | {N}ms |
| Report generation | {N}ms |
| **Total** | **{N}ms** |
```
