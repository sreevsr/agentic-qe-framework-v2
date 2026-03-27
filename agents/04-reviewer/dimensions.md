# Quality Dimensions

Audit each dimension and score 1-5.

**EXCLUDED from review scope — do NOT audit these directories:**
- `output/tools/` — standalone tooling (Scout agent, remote control). These are operational utilities, not part of the generated test framework. Do not flag `waitForTimeout`, `setTimeout`, `any` types, or other patterns in these files.

## 1. Locator Quality (Weight: High — web and hybrid only)
- [ ] Every element has a primary + at least 2 fallbacks in JSON
- [ ] Primary locators prefer data-testid or id over CSS classes
- [ ] No fragile selectors: no nth-child, no deep CSS paths, no auto-generated IDs
- [ ] No hardcoded selectors in page objects or test files
- Score: _/5

## 2. Wait Strategy (Weight: High)
- [ ] Navigation actions followed by `waitForLoadState` or `waitForURL`
- [ ] Form submissions followed by response/navigation waits
- [ ] Dynamic content uses `waitForSelector` with explicit state
- [ ] No unjustified `waitForTimeout` or `setTimeout` calls (see exception below)

**`waitForTimeout` exception — do NOT remove a call if BOTH of the following are true:**
1. The call has a `// PACING:` comment explaining why the delay is needed
2. The source application is documented as slow or component-heavy in
   `scenarios/app-contexts/` OR the comment explicitly references application speed,
   a Telerik/Kendo/complex UI component, or a dynamic content wait

Removing justified pacing waits causes regressions on slow applications. Flag
**unjustified** `waitForTimeout` calls (no `// PACING:` comment, no app-context
evidence) as before. The distinction is the comment — it is the contract between
the Healer that added the wait and the Reviewer that audits it.

- Score: _/5

## 3. Test Architecture (Weight: Medium)
- [ ] Page Object Model properly implemented
- [ ] Test files import page objects — no direct Playwright API in tests
- [ ] Test data externalized to JSON — no hardcoded values in specs
- [ ] Multi-scenario files use `test.describe()` with `test.beforeEach()` for common setup
- [ ] DATASETS produce parameterized `for...of` loops, not duplicated test code
- [ ] VERIFY steps produce `expect()` assertions inline, not just at the end
- [ ] Tags formatted correctly: `{ tag: ['@tagName'] }`
- [ ] If `test-data/shared/` exists: scenario JSONs do not duplicate values already in shared files (e.g., user credentials, product catalogs)
- [ ] If `SHARED_DATA` keyword is used: spec imports `loadTestData` from `core/test-data-loader` (not direct JSON import)
- [ ] If `*.helpers.ts` exists for a page: spec imports the helpers class (`{PageName}WithHelpers as {PageName}`), not the base class. Flag if helpers exist but the spec imports the base class instead
- [ ] If `USE_HELPER` keyword is used in the scenario: verify the referenced method exists in the corresponding `*.helpers.ts` file and the spec calls it
- Score: _/5

## 4. Configuration (Weight: Medium)
- [ ] `channel: 'chrome'` (not `browserName: 'chrome'`)
- [ ] Timeouts configured (action, navigation)
- [ ] Screenshot on failure enabled (`screenshot: 'only-on-failure'`)
- [ ] Trace collection configured (`trace: 'on-first-retry'`)
- [ ] Video configured (`video: 'retain-on-failure'`)
- [ ] baseURL set correctly
- Score: _/5

## 5. Code Quality (Weight: Low)
- [ ] Consistent TypeScript — no mixed JS/TS
- [ ] No `any` types where avoidable
- [ ] Meaningful variable and method names
- [ ] JSDoc on page object public methods
- [ ] No unused imports
- [ ] Every async method call uses `await`
- [ ] `@types/node` is listed in devDependencies
- [ ] `dotenv` is listed in devDependencies
- Score: _/5

## 6. Maintainability (Weight: Medium)
- [ ] Adding a new page requires only: new locator JSON + new page object + new spec
- [ ] Changing a selector requires editing only the locator JSON file
- [ ] Test data changes require no code changes
- [ ] Framework core (locator-loader, base-page, test-data-loader) is generic and reusable
- [ ] Shared reference data (users, products) lives in `test-data/shared/`, not duplicated per scenario
- [ ] If team-maintained `*.helpers.ts` files exist: they follow the convention (`{PageName}WithHelpers extends {PageName}`, JSDoc with `@scenario-triggers`, `@helpers` tag on class). Flag helpers that lack JSDoc or don't follow the naming convention
- [ ] Custom helper logic is in `*.helpers.ts` files, not mixed into Generator-owned page objects. Flag if generated page objects contain methods that look manually added without a corresponding helpers file
- Score: _/5

## 7. Security (Weight: High)
- [ ] No passwords, tokens, or secrets hardcoded anywhere in code
- [ ] All credentials use `process.env.VARIABLE_NAME`
- [ ] `.env.example` exists with placeholder variable names
- [ ] `.gitignore` includes `.env`
- [ ] Scenario `.md` files use `{{ENV.VARIABLE}}` pattern, not real values
- Score: _/5

## 8. API Test Quality (Weight: Medium — applies to api and hybrid types)
- [ ] Uses Playwright's built-in `request` fixture (not axios/fetch)
- [ ] For hybrid: `{ page, request }` correctly destructured in test fixture
- [ ] API auth headers use `process.env.API_TOKEN`
- [ ] Response status assertions present for every API call
- [ ] Response body structure verified (not just status code)
- [ ] API chaining properly passes values between requests
- [ ] CAPTURE steps on API responses correctly use JSONPath or property access
- [ ] For hybrid: API assertions and UI assertions are both present where the scenario requires cross-channel verification
- Score: _/5

## 9. Scenario-to-Code Fidelity (Weight: HIGH — this is the most important dimension)

This dimension verifies that the generated spec is a faithful, complete, and exact translation of the source scenario. Every step, every assertion, and every keyword must have corresponding code that does exactly what the scenario describes. No omissions. No approximations. No silent failures.

**Source file:** Read the scenario .md file (from `scenarios/{type}/[{folder}/]{scenario}.md`)

### 9a. Step Completeness
**Step numbering is positional — the user's step numbers in the scenario may be wrong, duplicated, or out of order. Count steps by position (first step = 1, second = 2, etc.), not by the user's numbers.**
- [ ] Count every step in the source scenario by position (including steps in Common Setup Once, Common Setup, Common Teardown, Common Teardown Once)
- [ ] Count every `test.step('Step N —` call in the spec main test body (lifecycle hook steps are counted separately — see 9e)
- [ ] **Counts MUST match exactly** — any mismatch is an automatic FAIL
- [ ] Every main scenario step is wrapped in `await test.step('Step N — ...', async () => { ... })` — unwrapped step code is a FAIL
- [ ] `test.step()` numbers are sequential (1, 2, 3...) — not the user's original numbers
- [ ] Steps are in correct sequence — no reordering
- [ ] Each `test.step()` label matches the original step intent — no paraphrasing that changes meaning
- [ ] Template variables in labels use string interpolation (runtime values) — not placeholder names like `{{customerName}}`
- [ ] Multi-assertion VERIFY blocks use nested `test.step()` for each sub-assertion — a single `expect()` block with no nesting is acceptable only if the VERIFY has exactly one assertion
- [ ] **Do NOT flag** `test.step()` wrapper verbosity as unnecessary nesting — it is intentional
- [ ] **Do NOT flag** a VERIFY_SOFT step showing ✅ when the soft assertion failed — this is expected Playwright behavior

### 9b. Plain Action Steps
- [ ] Every navigation step produces `page.goto()` or navigation click + wait
- [ ] Every click step produces a click on the correct element via page object
- [ ] Every fill/type step produces a fill with the correct value
- [ ] The code for each step performs the exact action described — not a different or simplified action

### 9c. Assertion Fidelity
- [ ] Every VERIFY in the scenario has a corresponding `expect()` hard assertion in the spec
- [ ] Every VERIFY_SOFT in the scenario has a corresponding `expect.soft()` in a block scope `{ }` with auto-screenshot on failure
- [ ] No VERIFY was converted to VERIFY_SOFT or vice versa
- [ ] Expected values match the scenario verbatim — no weakened, generalized, or approximated assertions (e.g., scenario says "equals 2" → code uses `.toBe(2)`, not `.toBeGreaterThan(0)`)
- [ ] Assertions appear at the same position in the test flow as in the scenario — not batched at the end
- [ ] Count: VERIFY in scenario = `expect()` assertions in spec | VERIFY_SOFT in scenario = `expect.soft()` blocks in spec

### 9d. Keyword Code Patterns
For each keyword found in the scenario, verify the spec contains the correct code pattern:

- [ ] **CAPTURE** → `const varName = await pageObject.getMethod()` for each instance. Count matches.
- [ ] **CALCULATE** → Arithmetic matching the exact formula. Count matches.
- [ ] **SCREENSHOT** → `page.screenshot({ fullPage: true })` + `test.info().attach('name')` for each instance. Count matches.
- [ ] **REPORT** → `test.step()` label includes the runtime variable value AND `test.info().annotations.push()` inside the step body. Count matches. `console.log()` is NOT required — do not flag its absence. (Missing `test.step()` wrapper or missing `annotations.push()` = FAIL)
- [ ] **SAVE** → `saveState('key', value)` for each instance. Count matches.
- [ ] **USE_HELPER** → Helper method call or WARNING + `test.fixme()` if helper missing. Count matches.
- [ ] **DATASETS** → `for...of` parameterized loop covering all data rows
- [ ] **SHARED_DATA** → `loadTestData` import and correct dataset names
- [ ] **API steps** → `request.{method}()` with status assertion for each API call. Count matches.

### 9e. Lifecycle Hook Fidelity (multi-scenario files)
- [ ] If `Common Setup Once` in scenario → `test.beforeAll()` exists with ALL steps from that section
- [ ] If `Common Setup` in scenario → `test.beforeEach()` exists with ALL steps from that section
- [ ] If `Common Teardown` in scenario → `test.afterEach()` exists with ALL steps from that section
- [ ] If `Common Teardown Once` in scenario → `test.afterAll()` exists with ALL steps from that section
- [ ] `beforeAll`/`afterAll` destructure ONLY `{ browser }` — never `{ page }` or `{ request }`
- [ ] Steps inside lifecycle hooks are wrapped in `test.step()` with semantic prefix labels: `[Setup]`, `[Before Each]`, `[After Each]`, `[After All]` — no step numbers in lifecycle hooks

### Scoring
- **5/5** — Every step, assertion, and keyword has exact corresponding code. Zero gaps.
- **4/5** — 1-2 minor discrepancies (e.g., a STEP comment description paraphrases slightly but code is correct)
- **3/5** — 1-2 missing steps or keywords, but assertions are intact
- **2/5** — Multiple missing steps/keywords, OR an assertion is weakened/missing
- **1/5** — Significant gaps: multiple steps dropped, assertions missing, keywords not implemented

**Verdict: FAIL if score is below 4. This dimension has ZERO tolerance for missing assertions or dropped steps.**

- Score: _/5
