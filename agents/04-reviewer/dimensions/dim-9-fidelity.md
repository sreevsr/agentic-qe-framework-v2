# Dimension 9: Scenario-to-Code Fidelity (Weight: HIGH — Most Important)

**Applies to:** ALL types. This is the HARD GATE for approval.

**This dimension verifies that the generated spec is a faithful, complete, and exact translation of the source scenario.** Every step, every assertion, and every keyword MUST have corresponding code that does exactly what the scenario describes. No omissions. No approximations. No silent failures.

## Files to Examine
- Source scenario `.md` file
- Generated spec file
- `agents/shared/keyword-reference.md` (for correct code patterns)
- Explorer report (for step results, blocked steps)
- Executor report (for test pass/fail status)

## 9a. Step Completeness — MANDATORY

**Step numbering is positional** — count by position, not user's numbers.

- [ ] Count every step in the source scenario by position (ALL sections: Setup Once, Setup, Steps, Teardown, Teardown Once)
- [ ] Count every `test.step()` call in the spec
- [ ] **Counts MUST match exactly** — any mismatch is an automatic FAIL. `test.fixme()` steps COUNT as present (blocked but documented). Record: `Blocked steps (test.fixme): [N]`
- [ ] Every step wrapped in `await test.step('Step N — ...', async () => { ... })` — unwrapped code is a FAIL
- [ ] `test.step()` numbers are sequential (1, 2, 3...) — not user's original numbers
- [ ] Steps in correct sequence — no reordering
- [ ] Step labels match original intent — no meaning-changing paraphrases
- [ ] Template variables in labels use string interpolation (runtime values) — not placeholder names
- [ ] Multi-assertion VERIFY blocks use nested `test.step()` for each sub-assertion
- [ ] **Do NOT flag** `test.step()` wrapper verbosity as unnecessary nesting — it is intentional
- [ ] **Do NOT flag** a VERIFY_SOFT step showing pass when the soft assertion failed — expected Playwright behavior

## 9b. Plain Action Steps

- [ ] Every navigation step produces `page.goto()` or navigation click + wait
- [ ] Every click step produces a click on the correct element via page object
- [ ] Every fill/type step produces a fill with the correct value
- [ ] The code for each step performs the EXACT action described — not a different or simplified action

## 9c. Assertion Fidelity

- [ ] Every VERIFY → `expect()` hard assertion in spec
- [ ] Every VERIFY_SOFT → `expect.soft()` in block scope `{ }` with auto-screenshot on failure
- [ ] No VERIFY converted to VERIFY_SOFT or vice versa — NEVER
- [ ] Expected values match scenario verbatim — no weakened, generalized, or approximated assertions
- [ ] Assertions at same position in test flow as in scenario — not batched at end
- [ ] Count: VERIFY in scenario = `expect()` in spec | VERIFY_SOFT = `expect.soft()` blocks

## 9c-alpha. Scenario-Locked Test Data — MANDATORY (Guardrail)

The Executor MUST NOT silently change a test-data JSON value that is stated verbatim in the scenario's `## Test Data` table. Such changes hide real POTENTIAL BUGs — the correct response is `test.fixme('POTENTIAL BUG: ...')` with a `test.info().annotations.push({ type: 'potentialBug', ... })`.

- [ ] Read precheck evidence `dim9_fidelity.testDataDivergence`. For every divergence entry where `hasFixmeAnnotation === false`: **CRITICAL — cap Dim 9 at 3/5 and cite in findings.** The spec must preserve the scenario value and annotate the divergence, not mutate the JSON.
- [ ] For divergence entries where `hasFixmeAnnotation === true`: verify the fixme reason cites both the scenario value and the observed app value. Partial annotation is acceptable but should be noted as a recommendation.

## 9c-beta. Soft-Fail Surfacing — MANDATORY

A test whose `expect.soft()` assertion fails still passes overall in Playwright. Silent soft failures can indicate: (a) a helper returning `""` / `null` so the assertion never actually verifies, (b) a real app bug being accepted without annotation, (c) a flaky selector that was never investigated.

- [ ] Read precheck evidence `dim9_fidelity.softFailures`. If `softFailuresDetected > 0`:
  - [ ] **EACH soft failure must have an explicit "Known Soft Failures" table entry in the Executor report AND a documented reason** (known app behavior, known bug, accepted flakiness). Untriaged soft failures are a Dim 9 finding — cap at 4/5 if any untriaged.
  - [ ] If a helper method returns `""` / empty array and is consumed by `expect.soft(x).toContain(...)`, the assertion structurally cannot fail or pass meaningfully. **CRITICAL — cap Dim 9 at 3/5 and cite the specific method.**

## 9d. Keyword Code Patterns

For each keyword in the scenario, verify the spec has the correct code:

- [ ] **CAPTURE** → `let varName` in outer scope, assigned via getter inside `test.step()`. Count matches.
- [ ] **CALCULATE** → Arithmetic matching the exact formula. Count matches.
- [ ] **SCREENSHOT** → `page.screenshot({ fullPage: true })` + `test.info().attach('name')`. Count matches.
- [ ] **REPORT** → `test.step()` label includes runtime value (template literal) AND `test.info().annotations.push()`. `console.log()` NOT required. Count matches.
- [ ] **SAVE** → `saveState('key', value)`. Count matches.
- [ ] **USE_HELPER** → Helper method call, or WARNING + `test.fixme()` if helper missing. Count matches.
- [ ] **DATASETS** → `for...of` parameterized loop covering all data rows.
- [ ] **SHARED_DATA** → `loadTestData` import with correct dataset names.
- [ ] **API steps** → `request.{method}()` with status assertion. Count matches.

## 9e. Lifecycle Hook Fidelity (multi-scenario files)

- [ ] `Common Setup Once` in scenario → `test.beforeAll()` with ALL steps
- [ ] `Common Setup` → `test.beforeEach()` with ALL steps
- [ ] `Common Teardown` → `test.afterEach()` with ALL steps
- [ ] `Common Teardown Once` → `test.afterAll()` with ALL steps
- [ ] `beforeAll`/`afterAll` destructure ONLY `{ browser }` — NEVER `{ page }` or `{ request }`
- [ ] Lifecycle hook steps use semantic prefix labels: `[Setup]`, `[Before Each]`, `[After Each]`, `[After All]` — no step numbers

## Scoring

- **5/5** — Every step, assertion, and keyword has exact corresponding code. Zero gaps.
- **4/5** — 1-2 minor discrepancies (step label paraphrases slightly but code is correct)
- **3/5** — 1-2 missing steps or keywords, but assertions are intact
- **2/5** — Multiple missing steps/keywords, OR an assertion is weakened/missing. Also: CAPPED here if `TESTS_STATUS=FAILING`.
- **1/5** — Significant gaps: multiple steps dropped, assertions missing, keywords not implemented

**Verdict: FAIL if score below 4. This dimension has ZERO tolerance for missing assertions or dropped steps.**

**Score: _/5**
