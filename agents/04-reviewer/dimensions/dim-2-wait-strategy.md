# Dimension 2: Wait Strategy (Weight: High)

**Applies to:** ALL types.

## Files to Examine
- Page objects from manifest (`output/pages/*Page.ts`)
- Spec file (`output/tests/{type}/*.spec.ts`)

## Checklist — MUST score each item

- [ ] Navigation actions followed by `waitForLoadState` or `waitForURL`
- [ ] Form submissions followed by response/navigation waits
- [ ] Dynamic content uses `waitForSelector` with explicit state
- [ ] No unjustified `waitForTimeout` or `setTimeout` calls

**`waitForTimeout` exception — do NOT flag a call if BOTH are true:**
1. The call has a `// PACING:` comment explaining why the delay is needed
2. The application is documented as slow in `scenarios/app-contexts/` OR the comment references app speed, a complex UI component, or a dynamic content wait

**Removing justified pacing waits causes regressions.** Flag ONLY unjustified waits (no `// PACING:` comment, no app-context evidence).

## Scoring
- **5/5** — Every navigation/interaction has appropriate waits, zero unjustified delays
- **4/5** — 1-2 missing waits after navigation, but no unjustified delays
- **3/5** — Several missing waits, or 1 unjustified waitForTimeout
- **2/5** — Multiple unjustified delays, missing waits cause likely race conditions
- **1/5** — No wait strategy at all, or pervasive waitForTimeout usage

**Score: _/5**
