# Keyword Reference — Scenario Keywords and TypeScript Code Patterns

**MANDATORY: This is the authoritative reference for ALL scenario keywords. Every agent MUST follow these patterns EXACTLY. DO NOT deviate from the code patterns shown here.**

Each agent interprets keywords for its role:
- **Explorer:** Verifies the keyword action works in the live browser. Records the result in enriched.md.
- **Builder:** Translates the keyword into TypeScript code using verified locators from Scout.
- **Executor:** Validates keyword implementations work at runtime and fixes timing issues.
- **Reviewer:** Audits keyword implementations against quality standards.

**For mobile scenarios:** The same keywords apply. "Click" maps to "Tap", "Scroll" maps to "Swipe", etc. The Builder translates mobile-specific language to the appropriate Playwright/Appium code.

---

## VERIFY — Mid-Step Assertions

**Scenario:** `VERIFY: Cart badge shows "2"`

**Explorer action** (verify in browser) / **Builder action** (generate code): Check the stated condition on the current page and log pass/fail.

**Generated code:**
```typescript
// VERIFY: Cart badge shows "2"
expect(await inventoryPage.getCartBadgeCount()).toBe(2);

// VERIFY: URL contains "/dashboard"
await expect(page).toHaveURL(/\/dashboard/);
```

**Executor rule:** If VERIFY fails but the selector IS correct (element found, wrong content), flag as POTENTIAL BUG — do NOT change the expected value.

**Reviewer check:** VERIFY steps must produce `expect()` assertions inline, not just at the end.

---

## VERIFY_SOFT — Non-Blocking Assertions

**Scenario:** `VERIFY_SOFT: Cart badge shows "2"`

**Explorer action** (verify in browser) / **Builder action** (generate code): Same as VERIFY — check the stated condition on the current page and log pass/fail.

**Generated code (with auto-screenshot on failure):**
```typescript
// VERIFY_SOFT: Cart badge shows "2"
{
  const result = await inventoryPage.getCartBadgeCount();
  expect.soft(result).toBe(2);
  if (result !== 2) {
    const screenshot = await page.screenshot({ fullPage: true });
    await test.info().attach('VERIFY_SOFT-failed-cart-badge', { body: screenshot, contentType: 'image/png' });
  }
}

// For URL/page-level assertions:
// VERIFY_SOFT: URL contains "/dashboard"
{
  const url = page.url();
  expect.soft(url).toContain('/dashboard');
  if (!url.includes('/dashboard')) {
    const screenshot = await page.screenshot({ fullPage: true });
    await test.info().attach('VERIFY_SOFT-failed-url-dashboard', { body: screenshot, contentType: 'image/png' });
  }
}
```

The block scope `{ }` prevents variable name collisions when multiple VERIFY_SOFT steps appear in sequence. The screenshot attachment name should be descriptive: `VERIFY_SOFT-failed-{short-description}`. Each screenshot is bound to the currently running test — Playwright's HTML report shows it under that specific scenario.

**Behavior:** Unlike VERIFY (which stops the test on failure), VERIFY_SOFT logs the failure but **continues executing** the remaining steps. The test is still marked as failed in the report, but all subsequent steps run. Use this when you want to check multiple conditions and see all failures at once, rather than stopping at the first one.

**When to use VERIFY vs VERIFY_SOFT:**
- `VERIFY` — The remaining steps depend on this condition being true (e.g., verifying login succeeded before proceeding to checkout)
- `VERIFY_SOFT` — The remaining steps can run regardless (e.g., checking multiple field values on a summary page)

**Executor rule:** Same as VERIFY — if VERIFY_SOFT fails but the selector IS correct (element found, wrong content), flag as POTENTIAL BUG — do NOT change the expected value. Never convert VERIFY_SOFT to VERIFY or vice versa.

**Reviewer check:** VERIFY_SOFT steps must produce `expect.soft()` assertions. Verify that VERIFY_SOFT is not used for conditions that subsequent steps depend on.

---

## CAPTURE — Store Runtime Values

**Scenario:** `CAPTURE: Read subtotal as {{subtotal}}`

**Explorer action** (verify in browser) / **Builder action** (generate code): Read the specified value from the page and record it with the `{{variableName}}`.

**Generated code:**
```typescript
// CAPTURE variable MUST be declared with `let` in OUTER test scope (not inside test.step)
let subtotal: string;

// Inside test.step:
await test.step('Step 5 — CAPTURE: Read subtotal', async () => {
  subtotal = await checkoutPage.getSubtotal();
});
```

**MANDATORY:** CAPTURE variables MUST use `let` in the outer scope and be assigned inside `test.step()`. Using `const` inside the step makes the value inaccessible to subsequent steps. Page objects MUST have getter methods that return the captured value (e.g., `getSubtotal(): Promise<string>`).

---

## CALCULATE — Arithmetic on Captured Values

**Scenario:** `CALCULATE: {{expectedTotal}} = {{subtotal}} + {{tax}}`

**Explorer action** (verify in browser) / **Builder action** (generate code): Perform the math on captured values and record the result.

**Generated code:**
```typescript
// CALCULATE: {{expectedTotal}} = {{subtotal}} + {{tax}}
const expectedTotal = (parseFloat(subtotal.replace('$', '')) + parseFloat(tax.replace('$', ''))).toFixed(2);
```

---

## SCREENSHOT — Visual Evidence

**Scenario:** `SCREENSHOT: checkout-overview`

**Explorer action** (verify in browser) / **Builder action** (generate code): Take a visual screenshot and note the filename.

**Generated code:**
```typescript
// SCREENSHOT: checkout-overview
const screenshot = await page.screenshot({ fullPage: true });
await test.info().attach('checkout-overview', { body: screenshot, contentType: 'image/png' });
```

---

## REPORT — Console Output and Annotations

**Scenario:** `REPORT: Print subtotal, tax, total`

**Explorer action** (verify in browser) / **Builder action** (generate code): Note that this value should appear in test output — record it.

**Generated code:**
```typescript
// The step label with interpolated runtime value IS the primary report.
// Use template literals so the HTML report shows real data.
await test.step(`Step 8 — REPORT: Subtotal=${subtotal}, Tax=${tax}, Total=${total}`, async () => {
  test.info().annotations.push({ type: 'subtotal', description: subtotal });
  test.info().annotations.push({ type: 'tax', description: tax });
  test.info().annotations.push({ type: 'total', description: total });
});
```
**MANDATORY:** The `test.step()` label with template literals IS the report — humans read step labels in the HTML report. `console.log()` is NOT required. `annotations.push()` adds machine-readable data.

---

## SAVE — Persist Values Across Scenarios

**Scenario:** `SAVE: {{orderNumber}} to shared-state.json as "lastOrderNumber"`

**Explorer action** (verify in browser) / **Builder action** (generate code): Note that this value needs to be persisted — record the key name.

**Generated code:**
```typescript
// SAVE: Write {{orderNumber}} to shared-state.json as "lastOrderNumber"
import { saveState } from '../core/shared-state';
saveState('lastOrderNumber', orderNumber);
```

---

## DATASETS — Data-Driven Parameterized Tests

**Scenario:**
```markdown
## DATASETS
| username | password | expectedResult |
|----------|----------|----------------|
| standard_user | secret_sauce | success |
| locked_out_user | secret_sauce | error |
```

**Explorer action** (verify in browser) / **Builder action** (generate code): Execute only the FIRST data row. Note all rows for code generation.

**Generated code:**
```typescript
import testData from '../test-data/login-datasets.json';

for (const data of testData) {
  test(`Login: ${data.username || '(empty)'} — expects ${data.expectedResult}`,
    { tag: ['@regression'] },
    async ({ page }) => {
      // Use data.username, data.password, etc.
  });
}
```

---

## SHARED_DATA — Load Reusable Reference Data

**Scenario:** `## SHARED_DATA: users, products`

**Generated code:**
```typescript
// SHARED_DATA: users, products
import { loadTestData } from '../../core/test-data-loader';
const testData = loadTestData('web/saucedemo-checkout', ['users', 'products']);
// testData merges shared/users.json + shared/products.json + web/saucedemo-checkout.json
```

**Reviewer check:** If `SHARED_DATA` keyword is used, spec must import `loadTestData` from `core/test-data-loader` (not direct JSON import).

---

## USE_HELPER — Call Team-Maintained Helper Methods

**Scenario:** `USE_HELPER: CartPage.calculateTotalPrice -> {{cartTotal}}`

**Generated code:**
```typescript
// USE_HELPER: CartPage.calculateTotalPrice -> {{cartTotal}}
const cartTotal = await cartPage.calculateTotalPrice();

// USE_HELPER: CartPage.validateAllCartPrices (no capture — just call it)
await cartPage.validateAllCartPrices();
```

**Format:** `USE_HELPER: PageName.methodName` or `USE_HELPER: PageName.methodName -> {{variable}}`

**HARD STOP:** If the helpers file does not exist or the method is not found:
- Do NOT create the helpers file
- Do NOT add the method to the base page object
- Emit a warning comment: `// WARNING: USE_HELPER requested CartPage.calculateTotalPrice but CartPage.helpers.ts not found`
- Mark the test step with `test.fixme('MISSING HELPER: CartPage.calculateTotalPrice')`

---

## File Download — Capture and Verify Downloaded Files

**Scenario:** `Click "Download Invoice" button` followed by `VERIFY: Invoice file is downloaded successfully to OS' default Downloads folder`

**Explorer action** (verify in browser) / **Builder action** (generate code): Use Playwright's download event API to capture the file. If the scenario specifies a download location (e.g., "OS' default Downloads folder"), use THAT location — do NOT substitute a project-local path.

**Generated code:**
```typescript
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';

// Click download trigger and capture the download event
await test.step('Step N — Click "Download Invoice" button', async () => {
  const downloadPromise = page.waitForEvent('download');
  await orderPage.clickDownloadInvoice();
  const download = await downloadPromise;

  // Save to the location specified in the scenario
  // If scenario says "OS' default Downloads folder":
  const downloadsDir = path.join(os.homedir(), 'Downloads');
  const downloadPath = path.join(downloadsDir, download.suggestedFilename());
  await download.saveAs(downloadPath);

  // Store path for subsequent VERIFY steps
  test.info().annotations.push({ type: 'downloadPath', description: downloadPath });
});

// VERIFY: File downloaded
await test.step('Step N+1 — VERIFY: Invoice file is downloaded', async () => {
  const ann = test.info().annotations.find(a => a.type === 'downloadPath');
  const downloadPath = ann?.description ?? '';
  expect(fs.existsSync(downloadPath)).toBe(true);
});

// VERIFY: File content check
await test.step('Step N+2 — VERIFY: Invoice contains "John Doe"', async () => {
  const ann = test.info().annotations.find(a => a.type === 'downloadPath');
  const downloadPath = ann?.description ?? '';
  const content = fs.readFileSync(downloadPath, 'utf-8');
  expect(content).toContain('John Doe');
});
```

**MANDATORY Rules:**
- `acceptDownloads: true` MUST be set in `playwright.config.ts` (under `use:`)
- Use `page.waitForEvent('download')` BEFORE the click that triggers the download
- **If the scenario specifies a download location, use it literally.** "OS' default Downloads folder" → `path.join(os.homedir(), 'Downloads')`. "project downloads folder" → `path.join(process.cwd(), 'downloads')`. Do NOT substitute your own path.
- If the scenario does NOT specify a location, default to `path.join(process.cwd(), 'downloads')` and create the directory if it doesn't exist
- Store the download path via `test.info().annotations` so subsequent VERIFY steps can access it

---

## Tags — CI/CD Filtering Labels

**Scenario:** `**Tags:** smoke, cart, P0`

**Generated code:**
```typescript
test('scenario name', { tag: ['@smoke', '@cart', '@P0'] }, async ({ page }) => { ... });
```

**MANDATORY:** Tags MUST have `@` prefix in generated code. Every test MUST have tags. DO NOT generate tests without tags.

---

## API Steps — REST API Calls

**Scenario:** `API POST: /api/users with body {"name": "John"}`

**Generated code:**
```typescript
const response = await request.post('/api/users', {
  data: { name: 'John' },
});
expect(response.status()).toBe(201);
const body = await response.json();
```

**MANDATORY Rules:**
- MUST use Playwright's `request` fixture exclusively — NEVER use `fetch` or `axios`
- For `api` type: destructure `{ request }` only
- For `hybrid` type: always destructure both `{ page, request }` — API steps are interleaved with UI steps
- For `web` type with ad-hoc API steps: destructure both `{ page, request }`
- Auth headers from environment variables: `Authorization: \`Bearer ${process.env.API_TOKEN}\``

---

## ENV_VARS — Environment Variable References

**Scenario:** `Navigate to {{ENV.BASE_URL}}`

**Generated code:**
```typescript
process.env.BASE_URL
```

**MANDATORY:** ALL `{{ENV.VARIABLE}}` references MUST become `process.env.VARIABLE`. NEVER hardcode credentials, URLs, or secrets.

---

## API Behavior — Mock vs Live Declaration

**Scenario header:** `## API Behavior: mock` or `## API Behavior: live`

- `mock` — API is non-persistent. Explorer-Builder or Executor may adapt tests for non-persistence (use existing IDs, accept mock responses).
- `live` or missing — API is real. All persistence/assertion guardrails apply with ZERO exceptions.
- NEVER infer API behavior from the URL or API name. ONLY the explicit `## API Behavior` header controls this. This is NON-NEGOTIABLE.

---

## Multi-Scenario Files

**Scenario:** Multiple `### Scenario:` blocks separated by `---` with optional lifecycle hooks

### Lifecycle Hooks

| Section in `.md` | Playwright Hook | Runs | Fixtures Available |
|-------------------|----------------|------|--------------------|
| `## Common Setup Once` | `test.beforeAll()` | Once before all scenarios | `{ browser }` only — no `page` or `request` |
| `## Common Setup` | `test.beforeEach()` | Before each scenario | `{ page }` / `{ request }` / `{ page, request }` per type |
| `## Common Teardown` | `test.afterEach()` | After each scenario | `{ page }` / `{ request }` / `{ page, request }` per type |
| `## Common Teardown Once` | `test.afterAll()` | Once after all scenarios | `{ browser }` only — no `page` or `request` |

All four sections are optional. Only generate the corresponding hook if the section exists in the scenario file.

**Explorer action** (verify in browser) / **Builder action** (generate code):
- `Common Setup Once` — Execute once at the very start, before any scenario
- `Common Setup` — Execute before each scenario (existing behavior)
- `Common Teardown` — Execute after each scenario completes
- `Common Teardown Once` — Execute once at the very end, after all scenarios

**Generated code:**
```typescript
test.describe('Feature Name', () => {
  test.beforeAll(async ({ browser }) => {
    // Common Setup Once steps
    // For browser steps: const page = await browser.newPage(); ... await page.close();
    // For API steps: const ctx = await (await import('@playwright/test')).request.newContext(); ... await ctx.dispose();
  });

  test.beforeEach(async ({ page }) => {
    // Common Setup steps
  });

  test('Scenario 1', { tag: ['@smoke'] }, async ({ page }) => { ... });
  test('Scenario 2', { tag: ['@regression'] }, async ({ page }) => { ... });

  test.afterEach(async ({ page }) => {
    // Common Teardown steps
  });

  test.afterAll(async ({ browser }) => {
    // Common Teardown Once steps
    // Same fixture rules as beforeAll
  });
});
```

**beforeAll/afterAll fixture constraint:** These hooks receive only `{ browser }` from Playwright. If the hook steps require a page, create one manually: `const page = await browser.newPage()` and close it when done. If they require API calls, create a request context: `const ctx = await playwrightRequest.newContext()` and dispose it when done. Always clean up created resources.

**Executor rule:** If `beforeAll` or `afterAll` code uses `{ page }` or `{ request }` fixtures directly, that is a code error — fix by switching to `{ browser }` and creating resources manually.

**Reviewer check:** Verify `beforeAll`/`afterAll` destructure only `{ browser }`, never `{ page }` or `{ request }`.

---

---

## Mobile Action Keywords — Mobile Scenario Mapping

For mobile scenarios (type: `mobile` or `mobile-hybrid`), testers use mobile-specific verbs. The Explorer-Builder MUST translate these to the appropriate Appium/WDIO code:

| Scenario writes | Maps to | Generated code (WDIO + Appium) |
|----------------|---------|-------------------------------|
| "Tap [element]" | mobile/interact (tap) | `await $('~elementId').click()` |
| "Long press [element]" | mobile/interact (longPress) | `await driver.touchAction([{action: 'longPress', element: await $('~elementId')}, {action: 'release'}])` |
| "Swipe up / down / left / right" | mobile/interact (swipe) | `await driver.execute('mobile: swipe', { direction: 'up' })` |
| "Scroll to [element]" | mobile/interact (scroll) | `await driver.execute('mobile: scrollGesture', { direction: 'down', percent: 0.75 })` |
| "Type [text] in [field]" | mobile/interact (type) | `const field = await $('~fieldId'); await field.clearValue(); await field.setValue(text);` |
| "VERIFY: [element] is displayed" | mobile/verify | `expect(await $('~elementId').isDisplayed()).toBe(true)` |
| "VERIFY: [element] text is [value]" | mobile/verify | `expect(await $('~elementId').getText()).toBe(value)` |
| "Launch app" | mobile/navigate | `await driver.launchApp()` |
| "Navigate back" | mobile/navigate | `await driver.back()` |
| "Switch to WebView" | mobile/navigate | `await driver.switchContext('WEBVIEW_...')` |

**MANDATORY:** After typing in any field, **MUST** hide keyboard: `await driver.hideKeyboard()` — keyboard may block the next element.

**Locator priority for mobile:** `accessibility_id` (`~elementId`) > `id` > `-ios class chain` / `UiSelector` > xpath (LAST resort)

---

## Step Completeness Rule — MANDATORY

**HARD STOP: Every step in the source scenario MUST produce a corresponding `await test.step('Step N — [description]', async () => { ... })` block in the test spec.** NEVER combine, merge, or skip steps — navigation and wait steps matter as much as actions.

After writing the spec, count `test.step()` calls vs source steps — they **MUST match exactly**.

**Step numbering is positional, not user-authored.** The user's step numbers in the scenario .md file may be incorrect, duplicated, out of order, or missing. Do NOT rely on them. Instead:
- Read the scenario top-to-bottom
- Assign sequential numbers by position: the first step encountered is STEP 1, the second is STEP 2, etc.
- Number continuously across all sections: Common Setup Once steps first, then Common Setup, then Scenario steps, then Common Teardown, then Common Teardown Once
- The `test.step('Step N — ...')` in the generated spec uses these positional numbers, NOT the user's original numbers
- The total count of `test.step()` calls must equal the total count of steps encountered positionally
- Lifecycle hook steps use semantic prefixes (`[Setup]`, `[Before Each]`, etc.) — NOT step numbers
