# Dimension 2: Wait Strategy (Weight: High)

**Applies to:** ALL types.

## Files to Examine
- Page objects from manifest (`output/pages/*Page.ts`)
- Spec file (`output/tests/{type}/*.spec.ts`)

## Checklist — MUST score each item

- [ ] Navigation actions followed by `waitForLoadState`, `waitForURL`, or an explicit landmark wait
- [ ] Form submissions followed by response/navigation waits
- [ ] Dynamic content uses `waitForSelector` / `waitFor({state:...})` with explicit state
- [ ] No unjustified `waitForTimeout` or `setTimeout` calls
- [ ] **Visibility-check discipline — MANDATORY (see code-generation-rules.md §17):**
  - [ ] Page-object methods whose name starts with `is` and ends with `Visible` (or `Hidden`) MUST wrap a bounded `locator.waitFor({state, timeout})` in try/catch. Bare `return await locator.isVisible()` (instant-false snapshot) is a Dim 2 critical finding.
  - [ ] Spec-level VERIFY / VERIFY_SOFT visibility checks MUST use `expect(loc).toBeVisible({timeout})` OR call a page-object helper that wraps `waitFor`. `expect(await pageObj.isXVisible()).toBeTruthy()` is acceptable ONLY if the helper itself wraps `waitFor`.
  - [ ] Bare `locator.isVisible()` is permitted ONLY with `.catch(() => false)` for optional-element existence gates (e.g., cookie banner dismissal) AND only with an explicit short `{ timeout }` option.
- [ ] **Pacing hierarchy (see explorer.md §4.8b):** prefer `waitForURL` / landmark `waitFor({state:'visible'})` / `waitForResponse` over `waitForLoadState('networkidle')`. `networkidle` on apps with analytics/websockets frequently times out — flag unexplained `networkidle` waits on apps whose enriched.md `## App Behavior:` signal is `spa-async` or `hybrid-hydration`.

**`waitForTimeout` exception — do NOT flag a call if BOTH are true:**
1. The call has a `// PACING:` comment explaining why the delay is needed
2. The application is documented as slow in `scenarios/app-contexts/` OR the comment references app speed, a complex UI component, or a dynamic content wait

**Removing justified pacing waits causes regressions.** Flag ONLY unjustified waits (no `// PACING:` comment, no app-context evidence).

**BasePage primitives available (when present in the project's base-page.ts):** `waitForReady(key, timeoutMs?)` and `isReady(key, timeoutMs?)` are the recommended primitives. If the project's BasePage exposes them, prefer those calls over inline `page.locator(...).waitFor(...)` in page objects — they centralize the timeout default and keep page-object code terse.

## Scoring
- **5/5** — Every navigation/interaction has appropriate waits, zero unjustified delays
- **4/5** — 1-2 missing waits after navigation, but no unjustified delays
- **3/5** — Several missing waits, or 1 unjustified waitForTimeout
- **2/5** — Multiple unjustified delays, missing waits cause likely race conditions
- **1/5** — No wait strategy at all, or pervasive waitForTimeout usage

**Score: _/5**
