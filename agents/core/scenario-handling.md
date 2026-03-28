# Scenario Handling — Multi-Scenario, App-Context, Subagent Splitting

**This file is MANDATORY reading when the scenario has 20+ steps, multiple `### Scenario:` blocks, lifecycle hooks, or DATASETS. If you are unsure — read it anyway. Missing these rules causes structural errors in the generated spec.**

---

## 1. Multi-Scenario Files

### 1.1: Structure Detection — MANDATORY

When the scenario `.md` has multiple `### Scenario:` blocks, you MUST generate a `test.describe()` wrapper with individual `test()` blocks:

```markdown
## Common Setup Once      → test.beforeAll({ browser })
## Common Setup           → test.beforeEach({ page })
### Scenario: Add Item    → test('Add Item', ...)
### Scenario: Remove Item → test('Remove Item', ...)
## Common Teardown        → test.afterEach({ page })
## Common Teardown Once   → test.afterAll({ browser })
```

**ALL four lifecycle sections are OPTIONAL.** Generate the corresponding hook ONLY if the section exists in the scenario file. DO NOT generate empty hooks.

### 1.2: Exploration Order — MANDATORY

You MUST explore in this exact order:

1. **Common Setup Once** — explore first, write `test.beforeAll()`
2. **Common Setup** — explore next, write `test.beforeEach()`
3. **Each `### Scenario:`** — explore independently. Each scenario starts from the state AFTER Common Setup
4. **Common Teardown** — explore, write `test.afterEach()`
5. **Common Teardown Once** — explore, write `test.afterAll()`

**DO NOT explore scenarios before setup is verified.** Setup failures cascade into every scenario.

### 1.3: Fixture Rules — HARD STOP

**`beforeAll` / `afterAll` → `{ browser }` ONLY**

**NEVER use `{ page }` or `{ request }` in beforeAll/afterAll. This is a Playwright constraint that causes runtime errors.**

If the hook needs a page:
```typescript
test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage();
  await test.step('[Setup] Navigate to app', async () => {
    await page.goto(process.env.BASE_URL!);
  });
  await page.close();
});
```

If the hook needs API calls:
```typescript
test.beforeAll(async ({ browser }) => {
  const ctx = await (await import('@playwright/test')).request.newContext();
  await test.step('[Setup] Seed test data', async () => {
    await ctx.post(`${process.env.API_BASE_URL}/seed`);
  });
  await ctx.dispose();
});
```

**`beforeEach` / `afterEach` → type-based fixture:**

| Type | Fixture |
|------|---------|
| web | `{ page }` |
| api | `{ request }` |
| hybrid | `{ page, request }` |

### 1.4: Step Labels in Hooks — MANDATORY

**MUST use semantic prefixes in lifecycle hooks, NOT step numbers:**

```typescript
await test.step('[Setup] Navigate to app', async () => { ... });
await test.step('[Before Each] Login with test user', async () => { ... });
await test.step('[After Each] Clear cart', async () => { ... });
await test.step('[After All] Delete test data', async () => { ... });
```

Main scenario steps use `Step 1`, `Step 2`, etc. — sequential, positional.

### 1.5: Tags on Multi-Scenario Tests

**Each `### Scenario:` block MUST have its own tags.** Extract from the scenario's `**Tags:**` line:

```typescript
test.describe('Shopping Cart', () => {
  test('Add item', { tag: ['@smoke', '@P0'] }, async ({ page }) => { ... });
  test('Remove item', { tag: ['@regression', '@P1'] }, async ({ page }) => { ... });
});
```

---

## 2. App-Context — Self-Improving Skills

### 2.1: Reading App-Context — MANDATORY (Before Exploration)

**MUST check for an app-context file before starting the core loop:**

```
scenarios/app-contexts/{app-identifier}.md
```

The app identifier comes from the URL domain:
- `epicview-qa.powerappsportals.com` → `epicview-qa.md`
- `www.saucedemo.com` → `saucedemo.md`

**If the file exists, you MUST read it.** It contains:
- Component patterns — known interaction strategies
- Navigation patterns — known redirect chains
- Wait patterns — known slow components
- Known issues — things to watch out for

**You MUST use this knowledge in the core loop.** When identifying elements (Step 4.3) and trying interactions (Step 4.4), try app-context patterns FIRST before blind exploration. This saves attempts and tokens.

### 2.2: Writing App-Context — MANDATORY (After Exploration)

After completing all steps, you MUST update the app-context with NEW patterns you discovered. DO NOT duplicate patterns already in the file.

**Format for each new pattern:**

```markdown
## Learned Pattern: [Component/Behavior Name]
- **Component:** [What kind of UI element]
- **Expected:** [What you tried first]
- **Actual:** [What actually worked]
- **Working approach:** [The successful strategy]
- **Discovered:** [Date]
```

**Examples of patterns worth recording:**
- Input fields that need `pressSequentially` instead of `fill`
- Elements that are SVG instead of IMG
- Dropdowns that need two-step click (open list → select option)
- Pages with redirect chains after authentication
- Components that load asynchronously (need `waitForFunction`)
- Cookie consent banner selectors that work for this app

**DO NOT record:** Generic Playwright knowledge, standard HTML element interactions, or patterns that are obvious from the element type.

---

## 3. Chunked Execution — Default Mode

### 3.1: Chunking is the Default Execution Mode

**Chunking is the Explorer-Builder's default execution mode.** There is no step threshold to "trigger" chunking — the Explorer-Builder ALWAYS creates a chunk plan (see `explorer-builder.md` Section 3.7). For short scenarios (≤ `maxStepsPerChunk` from `framework-config.json`, default 15), the plan is trivially one chunk executed directly by the parent. For longer scenarios, the plan has multiple chunks with subagent delegation.

**This replaces the previous conditional rule ("split at 40+ steps").** That rule failed because the LLM ignored it under context pressure. Chunking as a default architectural mode is not a rule the LLM can decide to skip — it IS the execution flow.

**Configuration:** `framework-config.json` field `chunking.maxStepsPerChunk` (default: 15). Field `chunking.alwaysChunk` (default: true) — set to `false` to revert to pre-chunking behavior.

**DO NOT split scenarios under 20 steps** advisory is REMOVED — the `maxStepsPerChunk` threshold handles this automatically. A 10-step scenario becomes one DIRECT chunk (zero overhead). A 20-step scenario becomes two chunks.

### 3.2: How to Split — MANDATORY Steps

1. **Identify natural breakpoints** — page transitions, phase changes, section headers in the scenario
2. **Group steps into chunks of up to `maxStepsPerChunk` (default 15)** at these breakpoints
3. **MUST save storageState** after auth/setup phase completes:
   ```typescript
   await page.context().storageState({ path: 'output/auth/storage-state.json' });
   ```
4. **Spawn a subagent for each step group** with:
   - The step range (e.g., "Explore steps 11-20")
   - storageState path (so subagent skips login)
   - Page objects and locators created so far (so subagent can reuse/extend them)
   - App-context file path
5. **Merge results** from all subagents — combine locator JSONs, page objects, spec steps into the final files

### 3.2a: Merge Conflict Rules — MANDATORY

When merging subagent results, conflicts may arise if two subagents touched the same file:

- **Page object:** If both subagents added methods to the same page object, the PARENT keeps both — no duplicates. If method names conflict (both add `clickSubmit`), the LATER subagent's version wins (it has more context about the page's final state)
- **Locator JSON:** If both added entries to the same locator file, merge all entries. If the same element name has different selectors, keep the one from the LATER step (more recent page state)
- **Spec steps:** Concatenate in step order — no conflict possible since each subagent owns a distinct step range
- **App-context:** Merge all learned patterns — no conflict possible (patterns are additive)

### 3.3: Platform-Specific Subagent Spawning

**Copilot (VS Code 1.113+):**
- Parent agent's `agents: ['step-explorer']` field makes the subagent available
- Invoke via the `step-explorer` subagent which has `user-invocable: false`
- Max nesting depth: 5 levels

**Claude Code:**
- Use the Agent tool:
  ```
  prompt: "Explore steps 11-20 of [scenario]. storageState at output/auth/storage-state.json.
           Read agents/core/explorer-builder.md for the core loop.
           Read agents/core/code-generation-rules.md for code patterns.
           Read agents/core/quality-gates.md for guardrails.
           Existing page objects: [list files]. Existing locators: [list files]."
  ```
- **MUST include the file read instructions in the subagent prompt** — subagents do NOT inherit parent context

### 3.4: StorageState Handoff — MANDATORY

After the parent/first subagent completes authentication:
```typescript
await page.context().storageState({ path: 'output/auth/storage-state.json' });
```

Each subsequent subagent restores from this state — NO login replay needed. This saves significant time and tokens.

**IMPORTANT:** storageState files contain auth tokens and MUST be gitignored (already configured in `.gitignore`).

---

## 4. DATASETS — Data-Driven Parameterized Tests

### 4.1: Exploration Rule — MANDATORY

When the scenario contains `## DATASETS`:

1. **MUST explore using ONLY the first data row** — DO NOT explore every row
2. If the first row represents an ERROR case (e.g., "locked_out_user"), **prefer exploring a SUCCESS row first** — pick the first row that represents the primary/happy flow
3. The first row validates that the test flow works
4. The remaining rows are for parameterization — same flow, different data

### 4.2: Code Generation — MANDATORY Pattern

```typescript
import testData from '../test-data/web/scenario-name.json';

for (const data of testData) {
  test(`Login: ${data.username} — expects ${data.expectedResult}`,
    { tag: ['@regression'] },
    async ({ page }) => {
      const loginPage = new LoginPage(page);
      await test.step('Step 1 — Enter username', async () => {
        await loginPage.fillUsername(data.username);
      });
      await test.step('Step 2 — Enter password', async () => {
        await loginPage.fillPassword(data.password);
      });
      // ... remaining steps using data.fieldName
    });
}
```

### 4.3: Test Data File — MANDATORY

Save DATASETS table as JSON array at `output/test-data/{type}/{scenario}.json`:

```json
[
  { "username": "standard_user", "password": "secret_sauce", "expectedResult": "success" },
  { "username": "locked_out_user", "password": "secret_sauce", "expectedResult": "error" }
]
```

**MUST include ALL rows from the scenario DATASETS table, not just the first row.**

---

## 5. Hybrid Scenarios — Type-Specific Rules

### 5.1: Fixture — HARD STOP

**ALWAYS destructure `{ page, request }` in hybrid tests — BOTH fixtures, EVERY test.**

Even if a particular test only uses API calls, the fixture declaration MUST include both:
```typescript
test('Hybrid test', { tag: ['@hybrid'] }, async ({ page, request }) => { ... });
```

### 5.2: Step Classification — MANDATORY

For each step in a hybrid scenario, classify:
- **UI step** (Navigate, Click, Fill, VERIFY on page) → use browser, web/* skills
- **API step** (API GET/POST/PUT/DELETE, CAPTURE from response) → use request fixture, api/* skills
- CAPTURE variables are shared between UI and API steps (outer scope `let`)

### 5.3: Tags — MANDATORY

Hybrid tests MUST include the `@hybrid` tag in addition to other tags:
```typescript
{ tag: ['@hybrid', '@smoke', '@P0'] }
```
