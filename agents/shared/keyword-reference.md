# Keyword Reference — Scenario Keywords and TypeScript Code Patterns

**MANDATORY: This is the authoritative reference for ALL scenario keywords. Every agent MUST follow these patterns EXACTLY. DO NOT deviate from the code patterns shown here.**

Each agent interprets keywords for its role:
- **Explorer:** Verifies the keyword action works in the live browser. Records the result in enriched.md.
- **Builder:** Translates the keyword into TypeScript code using locators extracted from Explorer's ELEMENT annotations.
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

**Where USE_HELPER can appear:** Any section of a scenario — `## Steps`, `## Common Setup Once`, `## Common Setup`, `## Common Teardown`, `## Common Teardown Once`. The Builder maps it to the corresponding Playwright lifecycle hook or test body.

**HARD STOP:** If the helpers file does not exist or the method is not found:
- Do NOT create the helpers file
- Do NOT add the method to the base page object
- Emit a warning comment: `// WARNING: USE_HELPER requested CartPage.calculateTotalPrice but CartPage.helpers.ts not found`
- Mark the test step with `test.fixme('MISSING HELPER: CartPage.calculateTotalPrice')`

### `@steps` — DSL in Helper Functions (Explorer-Walkable Helpers)

Team-maintained helper functions can carry a **`@steps` JSDoc tag** containing scenario DSL — the same numbered steps and keywords used in scenario `.md` files. This makes helpers **transparent to the Explorer**: instead of treating `USE_HELPER` as an opaque black box, the Explorer reads the `@steps` block and walks each step in the live browser for **state advancement**.

**Why this matters:** Without `@steps`, a `USE_HELPER` that does state-changing work (login, form submission, navigation) leaves the application in the wrong state — the Explorer skipped the interactions, so everything after the helper call fails. With `@steps`, the Explorer performs every interaction, the app state advances correctly, and all subsequent steps succeed.

#### Format

```typescript
// SSOLoginPage.helpers.ts
import { Page } from '@playwright/test';

/**
 * @steps
 * 1. Navigate to {{ENV.BASE_URL}}
 * 2. Enter {{email}} in the email field on the Microsoft SSO login page
 * 3. Enter {{password}} in the password field
 * 4. Click the Sign In button
 * 5. Wait for the ServicerHome page to load
 * 6. VERIFY: ServicerHome page is loaded and the left navigation panel is visible
 */
export async function login(page: Page, email: string, password: string): Promise<void> {
  await page.goto(process.env.BASE_URL!);
  await page.fill('#loginfmt', email);
  await page.click('#idSIButton9');
  await page.fill('#passwordInput', password);
  await page.click('#submitButton');
  await page.waitForURL('**/ServicerHome/**');
}

/**
 * @steps
 * 1. Click "SMEs" on the left navigation panel
 * 2. VERIFY: The SME Insights page is loaded and the National Specialty widget is visible
 * 3. Wait for the data grid within the National Specialty widget to finish loading
 */
export async function navigateToNationalSpecialty(page: Page): Promise<void> {
  await page.click('a:has-text("SMEs")');
  await page.waitForSelector('[id="ProducerDataGrid2"]');
}
```

#### Rules

1. **`@steps` uses the same DSL as scenario files.** Numbered steps, same keywords (VERIFY, VERIFY_SOFT, CAPTURE, SCREENSHOT, etc.). The Explorer processes them identically to regular scenario steps.
2. **Explorer walks `@steps` for state advancement ONLY — no element capture, ever.** The helper code is human-written, so the Explorer does not need to discover selectors. It clicks, fills, navigates, and verifies — but does NOT produce ELEMENT annotations for helper steps. Selectors are the human engineer's responsibility.
3. **Exported functions WITH `@steps` → callable via `USE_HELPER`.** The Explorer reads and walks the steps; the Builder generates a function call.
4. **Exported functions WITHOUT `@steps` → internal utilities.** NOT callable via `USE_HELPER`. If a scenario references a function that has no `@steps` block, the Builder MUST emit the same hard-stop as a missing function: `// WARNING: USE_HELPER requested X but no @steps found` + `test.fixme('MISSING @steps: X')`.
5. **Non-exported functions** are invisible to the framework entirely.

#### CAPTURE in `@steps` — Return Values

When a helper's `@steps` block contains a CAPTURE keyword, it serves as a **specification** for what the function returns. At runtime, the human-written TypeScript function implements the capture logic and returns the value. The calling scenario captures it via the `-> {{variable}}` syntax.

**Single CAPTURE** → function returns a value directly:
```typescript
/**
 * @steps
 * 1. Click "Create User" button
 * 2. Fill in the user form with test data
 * 3. Click "Submit"
 * 4. Wait for success confirmation
 * 5. CAPTURE: the new user ID from the confirmation message as {{userId}}
 */
export async function createTestUser(page: Page, userData: UserData): Promise<string> {
  // ... implementation
  return userId;
}
```

Scenario: `USE_HELPER: UserManagementPage.createTestUser -> {{newUserId}}`
Builder generates: `const newUserId = await userManagementPage.createTestUser(page, userData);`

**Multiple CAPTUREs** → function returns an object:
```typescript
/**
 * @steps
 * 1. Place the order
 * 2. CAPTURE: order number as {{orderNumber}}
 * 3. CAPTURE: confirmation code as {{confirmationCode}}
 */
export async function placeOrder(page: Page): Promise<{ orderNumber: string; confirmationCode: string }> {
  // ... implementation
  return { orderNumber, confirmationCode };
}
```

Scenario: `USE_HELPER: CheckoutPage.placeOrder -> {{orderResult}}`
Subsequent steps use: `{{orderResult.orderNumber}}`, `{{orderResult.confirmationCode}}`

#### Drift Detection

The `@steps` block and the TypeScript implementation can drift if someone updates one but not the other. This is checked by `scripts/review-precheck.js` — see the script's `@steps` validation check. It verifies that every `USE_HELPER` reference in the spec points to a function that has a `@steps` block, and flags missing blocks as a precheck warning.

---

## Control Flow Keywords — Conditional Logic, Loops, and Error Handling

**These keywords apply to ALL scenario types (web, api, hybrid, mobile, mobile-hybrid).** They express runtime control flow that cannot be represented as flat sequential steps.

### Enricher MUST use these when the user writes:
- "if ... then ..." / "when ... appears" / "in case of" → **IF / IF_ELSE**
- "repeat" / "for each" / "do this for every" / "swipe through all" → **REPEAT_UNTIL / FOR_EACH**
- "do this N times" → **REPEAT_TIMES**
- "try ... if not found ..." / "attempt ... otherwise" → **TRY_ELSE**

### Enricher MUST NOT:
- Unroll loops into hardcoded repeated steps (e.g., expanding "swipe through all photos" into 5 identical swipe+screenshot steps)
- Assume a fixed iteration count unless the user explicitly states one
- Flatten conditionals into unconditional steps (e.g., converting "if popup appears, dismiss it" into "dismiss popup")

---

### IF / IF_ELSE — Conditional Execution

**Scenario writes:**
```markdown
15. IF: A notification popup appears ("Allow notifications")
    a. Tap "Not Now" to dismiss it
16. Continue with the main flow
```

**Or with ELSE:**
```markdown
15. IF: The "Add to Cart" button is visible
    a. Tap "Add to Cart"
    ELSE:
    a. Tap "Go to Cart" (item already added from previous run)
```

**Builder generates (web):**
```typescript
await test.step('Step 15 — Handle Add to Cart state', async () => {
  const addToCart = page.locator(loc.get('addToCartButton'));
  if (await addToCart.isVisible({ timeout: 3000 }).catch(() => false)) {
    await addToCart.click();
  } else {
    await page.locator(loc.get('goToCartButton')).click();
  }
});
```

**Builder generates (mobile):**
```typescript
// Step 15 — Handle Add to Cart state
if (await productScreen.isVisible('addToCartButton')) {
  await productScreen.tap('addToCartButton');
} else {
  await productScreen.tap('goToCartButton');
}
```

---

### REPEAT_UNTIL — Loop Until a Condition is Met

**Scenario writes:**
```markdown
20. REPEAT_UNTIL: No more photos in the carousel
    a. SCREENSHOT: product-photo-{index}
    b. Swipe left on the product photo carousel
```

**Or:**
```markdown
12. REPEAT_UNTIL: The "Load More" button is no longer visible
    a. Scroll down
    b. CAPTURE: Number of visible items
```

**Builder generates (web):**
```typescript
await test.step('Step 20 — Capture all product photos', async () => {
  let index = 1;
  const maxIterations = 20; // Safety limit
  while (index <= maxIterations) {
    const screenshot = await page.screenshot({ fullPage: false });
    await test.info().attach(`product-photo-${index}`, { body: screenshot, contentType: 'image/png' });
    // Try to swipe — if no more photos, the carousel won't change
    const beforeSrc = await page.locator(loc.get('carouselImage')).getAttribute('src');
    await page.locator(loc.get('carouselNextArrow')).click().catch(() => {});
    await page.waitForTimeout(500);
    const afterSrc = await page.locator(loc.get('carouselImage')).getAttribute('src');
    if (beforeSrc === afterSrc) break; // No more photos
    index++;
  }
});
```

**Builder generates (mobile):**
```typescript
// Step 20 — Capture all product photos
let photoIndex = 1;
const maxPhotos = 20; // Safety limit
while (photoIndex <= maxPhotos) {
  await productScreen.takeScreenshot(`product-photo-${photoIndex}`);
  const beforeDesc = await productScreen.getAttribute('productImage', 'content-desc');
  await productScreen.swipe('left');
  await browser.pause(500);
  const afterDesc = await productScreen.getAttribute('productImage', 'content-desc');
  if (beforeDesc === afterDesc) break; // No more photos
  photoIndex++;
}
```

**Rules:**
- **MUST include a safety limit** (`maxIterations`) to prevent infinite loops — default 20
- **MUST detect the termination condition** at runtime (element disappeared, content unchanged, counter reached)
- The `{index}` placeholder in step text is replaced by the loop counter in generated code

---

### REPEAT_TIMES — Fixed Count Loop

**Scenario writes:**
```markdown
8. REPEAT_TIMES: 3
    a. Tap the "Add" button to increase quantity
```

**Builder generates:**
```typescript
// Step 8 — Increase quantity 3 times
for (let i = 0; i < 3; i++) {
  await screen.tap('addButton');
  await browser.pause(300);
}
```

---

### FOR_EACH — Iterate Over a Collection of Elements

**Scenario writes:**
```markdown
10. FOR_EACH: Item in the search results list (first 5 items)
    a. VERIFY: Item has a price displayed
    b. VERIFY: Item has a product image
```

**Or:**
```markdown
7. FOR_EACH: Row in the data table
    a. CAPTURE: The value in column "Status"
    b. VERIFY: Status is not empty
```

**Builder generates (web):**
```typescript
await test.step('Step 10 — Verify search result items', async () => {
  const items = await page.locator(loc.get('searchResultItems')).all();
  const limit = Math.min(items.length, 5);
  for (let i = 0; i < limit; i++) {
    const item = items[i];
    expect(await item.locator(loc.get('itemPrice')).isVisible()).toBe(true);
    expect(await item.locator(loc.get('itemImage')).isVisible()).toBe(true);
  }
});
```

**Builder generates (mobile):**
```typescript
// Step 10 — Verify search result items
// Note: Mobile FOR_EACH uses scrolling to iterate — elements may not all be in view
for (let i = 0; i < 5; i++) {
  const priceVisible = await resultsScreen.isVisible('itemPrice');
  expect(priceVisible).toBe(true);
  await resultsScreen.swipe('up'); // Scroll to next item
  await browser.pause(500);
}
```

**Rules:**
- If the user specifies a limit ("first 5 items"), use it. Otherwise default to all items up to safety limit of 20.
- For mobile, elements may not all be accessible at once — use scroll+check pattern instead of `.all()`

---

### TRY_ELSE — Attempt With Fallback

**Scenario writes:**
```markdown
5. TRY: Tap the "Accept Cookies" banner
   ELSE: Continue (no cookie banner present)
```

**Or:**
```markdown
12. TRY: Find the search bar by accessibility ID
    ELSE: Tap the search area by coordinates (300, 348)
```

**Builder generates (web):**
```typescript
await test.step('Step 5 — Dismiss cookie banner if present', async () => {
  try {
    const banner = page.locator(loc.get('cookieAcceptButton'));
    if (await banner.isVisible({ timeout: 3000 }).catch(() => false)) {
      await banner.click();
    }
  } catch {
    // No cookie banner — continue
  }
});
```

**Builder generates (mobile):**
```typescript
// Step 12 — Find search bar with fallback
try {
  await homeScreen.tap('searchBar');
} catch {
  // FRAGILE: Search bar has rotating content-desc, fallback to coordinates
  await browser.action('pointer')
    .move({ duration: 0, origin: 'viewport', x: 300, y: 348 })
    .down({ button: 0 }).pause(100).up({ button: 0 }).perform();
}
```

**Rules:**
- TRY_ELSE is for **expected variability** — elements that may or may not be present
- DO NOT use TRY_ELSE for assertions — if a VERIFY fails, it should fail the test, not silently catch
- The ELSE branch MUST either continue normally or document why it's acceptable to skip

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

- `mock` — API is non-persistent. Explorer or Executor may adapt tests for non-persistence (use existing IDs, accept mock responses).
- `live` or missing — API is real. All persistence/assertion guardrails apply with ZERO exceptions.
- NEVER infer API behavior from the URL or API name. ONLY the explicit `## API Behavior` header controls this. This is NON-NEGOTIABLE.

---

## Multi-Scenario Files

**Scenario:** Multiple `### Scenario:` blocks separated by `---` with optional lifecycle hooks

### Lifecycle Hooks

| Section in `.md` | Playwright Hook (web/api/hybrid) | Mocha Hook (mobile/mobile-hybrid) | Runs | Fixtures Available |
|-------------------|----------------|----------------|------|--------------------|
| `## Common Setup Once` | `test.beforeAll()` | `before()` | Once before all scenarios | Web/api/hybrid: `{ browser }` only. Mobile: global `browser` (always available) |
| `## Common Setup` | `test.beforeEach()` | `beforeEach()` | Before each scenario | Web/api/hybrid: `{ page }` / `{ request }` / `{ page, request }` per type. Mobile: global `browser` |
| `## Common Teardown` | `test.afterEach()` | `afterEach()` | After each scenario | Same as Common Setup |
| `## Common Teardown Once` | `test.afterAll()` | `after()` | Once after all scenarios | Same as Common Setup Once |

**Mobile fixture constraint:** None — WDIO `browser` is a global that is available in every Mocha hook (`before`, `beforeEach`, `afterEach`, `after`) and inside `it()` blocks. No need for `await browser.newPage()` or context creation.

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

**USE_HELPER in lifecycle hooks:** `USE_HELPER` steps can appear in any section. The Builder generates the helper function call inside the corresponding hook:

```typescript
test.describe('National Specialty Suite', () => {
  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    // USE_HELPER: SSOLoginPage.login — from Common Setup Once
    await ssoLoginPage.login(page, process.env.SSO_EMAIL!, process.env.SSO_PASSWORD!);
    await page.context().storageState({ path: 'test-results/.auth/session.json' });
    await page.close();
  });

  test.beforeEach(async ({ page }) => {
    // USE_HELPER: NavigationHelper.goToNationalSpecialty — from Common Setup
    await navigationHelper.goToNationalSpecialty(page);
  });

  test('Sort by Specialty', { tag: ['@regression'] }, async ({ page }) => {
    // Scenario steps start here — grid is already loaded
  });

  test.afterAll(async ({ browser }) => {
    const page = await browser.newPage();
    // USE_HELPER: SSOLoginPage.logout — from Common Teardown Once
    await ssoLoginPage.logout(page);
    await page.close();
  });
});
```

**beforeAll/afterAll fixture constraint:** These hooks receive only `{ browser }` from Playwright. If the hook steps require a page, create one manually: `const page = await browser.newPage()` and close it when done. If they require API calls, create a request context: `const ctx = await playwrightRequest.newContext()` and dispose it when done. Always clean up created resources.

**Executor rule:** If `beforeAll` or `afterAll` code uses `{ page }` or `{ request }` fixtures directly, that is a code error — fix by switching to `{ browser }` and creating resources manually.

**Reviewer check:** Verify `beforeAll`/`afterAll` destructure only `{ browser }`, never `{ page }` or `{ request }`.

---

---

## Mobile Action Keywords — Mobile Scenario Mapping

For mobile scenarios (type: `mobile` or `mobile-hybrid`), testers use mobile-specific verbs. The **Builder** translates these to Screen Object method calls (NOT raw WDIO/Appium commands). The Explorer captures element data via **Appium MCP**.

### Mobile Action → Screen Object Code

| Scenario writes | Generated code (via Screen Object) |
|----------------|-------------------------------|
| "Tap [element]" | `await screen.tap('elementKey')` |
| "Long press [element]" | `await screen.longPress('elementKey')` |
| "Swipe up / down / left / right" | `await screen.swipe('up')` |
| "Scroll to [element]" | `await screen.scrollToElement('elementKey')` |
| "Type [text] in [field]" | `await screen.typeText('elementKey', text)` (auto-hides keyboard) |
| "Navigate back" | `await screen.goBack()` |
| "VERIFY: [element] is displayed" | `expect(await screen.isVisible('elementKey')).toBe(true)` |
| "VERIFY: [element] text is [value]" | `expect(await screen.getText('elementKey')).toBe(value)` |
| "SCREENSHOT: [name]" | `await screen.takeScreenshot('name')` |
| "CAPTURE: [element] as {{var}}" | `capturedVar = await screen.getText('elementKey')` |
| "Dismiss overlays" | `await guard.dismiss()` (PopupGuard) |
| "Restart app" | `force-stop + relaunch` via `mobile: shell` |

### Mobile VERIFY Patterns (detailed)

```typescript
// VERIFY: element displayed
expect(await screen.isVisible('elementKey')).toBe(true);

// VERIFY: text value
expect(await screen.getText('elementKey')).toBe('expected');

// VERIFY: text contains (use toLowerCase for case-insensitive)
const text = await screen.getText('elementKey');
expect(text.toLowerCase()).toContain('expected');

// VERIFY: numeric value > 0
const speed = await screen.getText('downloadSpeed');
expect(parseFloat(speed)).toBeGreaterThan(0);
```

### Mobile SCREENSHOT Pattern

```typescript
await screen.takeScreenshot('screenshot-name');
// Saves PNG to test-results/screenshots/screenshot-name.png
```

### Mobile CAPTURE Pattern

```typescript
let downloadSpeed: string;
// Inside it():
downloadSpeed = await resultsScreen.getText('downloadSpeedValue');
console.log(`Download speed: ${downloadSpeed}`);
```

**MANDATORY:** `typeText()` in `BaseScreen` automatically hides keyboard after typing. If using raw driver commands, **MUST** call `await browser.hideKeyboard()` explicitly.

**Locator priority for mobile:** `accessibility_id` > `id` > `uiautomator`/`class_chain` > xpath (LAST resort, NEVER index-based)

**Appium MCP tools for Explorer:** `select_device` → `create_session` → `appium_get_page_source`/`generate_locators` → `appium_find_element` → `appium_click`/`appium_set_value` → `appium_screenshot` → `delete_session`

---

## Step Completeness Rule — MANDATORY

**For web/api/hybrid:** Every step in the source scenario MUST produce a corresponding `await test.step('Step N — [description]', async () => { ... })` block in the test spec. NEVER combine, merge, or skip steps.

**For mobile/mobile-hybrid:** Every step MUST produce a `// Step N — [description]` comment marker (no `test.step()` in WDIO/Mocha). Count comment markers vs source steps — they **MUST match exactly**.

After writing the spec, count step markers vs source steps — they **MUST match exactly**.

**Step numbering is positional, not user-authored.** The user's step numbers in the scenario .md file may be incorrect, duplicated, out of order, or missing. Do NOT rely on them. Instead:
- Read the scenario top-to-bottom
- Assign sequential numbers by position: the first step encountered is STEP 1, the second is STEP 2, etc.
- Number continuously across all sections: Common Setup Once steps first, then Common Setup, then Scenario steps, then Common Teardown, then Common Teardown Once
- The `test.step('Step N — ...')` in the generated spec uses these positional numbers, NOT the user's original numbers
- The total count of `test.step()` calls must equal the total count of steps encountered positionally
- Lifecycle hook steps use semantic prefixes (`[Setup]`, `[Before Each]`, etc.) — NOT step numbers

---

## Mobile-Specific Cross-Cutting Keyword Patterns

The following keywords have mobile-specific generation patterns. The web sections above are authoritative for Playwright; this section is authoritative for WDIO/Mocha.

### Mobile Platform Header — MANDATORY

Every mobile scenario `.md` file MUST declare a `Platform:` header in the Metadata section. This is the single source of truth for which platform(s) the scenario runs on. The framework does NOT segregate mobile scenarios into `scenarios/mobile/android/` / `scenarios/mobile/ios/` subdirectories — the platform dimension is handled entirely through this header + the platform-keyed locator JSON (`{ android: {...}, ios: {...} }`).

**Allowed values:**

| Value | Meaning | When to use |
|---|---|---|
| `android` | Runs only on Android | Android-first scenarios, Android-only features (Quick Settings, back button), or app not yet released on iOS |
| `ios` | Runs only on iOS | iOS-first scenarios, iOS-only features (Share Sheet extension, Haptic Touch), or app not yet released on Android |
| `both` | Runs on both platforms via platform-keyed locators | The flow is identical on Android and iOS (~90% of scenarios). REQUIRES every locator JSON entry to have both `android:` and `ios:` sub-objects. |

**Scenario format (the `_template.md` canonical form):**

```markdown
## Metadata
- **Module:** Flipkart — Shopping Cart
- **Priority:** P1
- **Type:** mobile
- **Platform:** both                   <!-- REQUIRED -->
- **Tags:** mobile, regression, shopping, P1
```

**Enricher rule:** When converting a natural-language description into a mobile scenario `.md`, the Enricher MUST emit a `Platform:` line. If the user does not specify the target platform explicitly, the Enricher defaults to `android` (the only GA platform as of the mobile feature parity Android GA release) and emits a note in the `## Notes for Explorer` section: `TODO: confirm platform — defaulted to android`.

**Builder rule:** When generating a spec from an enriched `.md`, the Builder MUST read the `Platform:` header and emit the corresponding tag in the top-level `describe` title string. The tag format is:

| Platform header | Spec `describe` tag |
|---|---|
| `android` | `@android-only` |
| `ios` | `@ios-only` |
| `both` | `@cross-platform` |

Example generated `describe` title:
```typescript
// From Platform: both
describe('Flipkart — Add to Cart Through Checkout @regression @P1 @cross-platform', () => { ... });

// From Platform: android
describe('Android Quick Settings toggle @smoke @P2 @android-only', () => { ... });

// From Platform: ios
describe('iOS Share Sheet extension @regression @P1 @ios-only', () => { ... });
```

**Runtime filter — MUST pass to wdio on every mobile run:**

```bash
# Android device / emulator: run Android-only + cross-platform scenarios
PLATFORM=android npx wdio run wdio.conf.ts --mochaOpts.grep "@android-only|@cross-platform"

# iOS simulator / device: run iOS-only + cross-platform scenarios
PLATFORM=ios npx wdio run wdio.conf.ts --mochaOpts.grep "@ios-only|@cross-platform"
```

Without the `--mochaOpts.grep` filter, a `PLATFORM=android` run would attempt to execute iOS-only specs (which would fail at the locator-lookup stage because the scenario's locator JSON has no `android:` entries). The filter is the cheap safety net.

**Reviewer check:** Dim 3 (Test Architecture) MUST verify that every mobile `describe` title contains exactly ONE of the three platform tags (`@android-only`, `@ios-only`, `@cross-platform`). Missing or multiple tags is a failing Dim 3 dimension.

**Locator JSON requirement for `Platform: both`:** When the scenario header says `both`, every element in every locator JSON used by the scenario's screen objects MUST have both an `android:` and an `ios:` sub-object with at least one valid strategy each. The Builder SHOULD refuse to emit a `@cross-platform` spec if any locator entry is missing one side (fail fast — this catches "I said both but I only captured Android" drift at generation time, not at runtime).

---

### Mobile Lifecycle Hooks — Code Pattern

```typescript
import { browser } from '@wdio/globals';
import { LoginScreen } from '../../../screens/LoginScreen';

describe('Feature Name @smoke @android-only', () => {
  let loginScreen: LoginScreen;

  before(async () => {
    // Common Setup Once steps (e.g. one-time login, test data load)
  });

  beforeEach(async () => {
    // Common Setup steps (e.g. force-stop + relaunch app, reset state)
    loginScreen = new LoginScreen(browser);
  });

  it('Scenario 1 @smoke', async () => { /* ... */ });
  it('Scenario 2 @regression', async () => { /* ... */ });

  afterEach(async () => {
    // Common Teardown steps (e.g. capture screenshot on failure — already auto)
  });

  after(async () => {
    // Common Teardown Once steps (e.g. cleanup test users)
  });
});
```

**Reviewer check (mobile):** `before`/`after` MUST NOT use Playwright fixtures. `browser` is a global; no destructuring required.

---

### VERIFY_SOFT — Mobile Pattern

WDIO's `expect-webdriverio` does NOT have `expect.soft()`. The mobile pattern uses a try/catch + a `softAssertions: string[]` array declared at outer describe scope, and a final throw at the end of `it()` if any soft failures occurred. `BaseScreen.recordSoftFailure()` handles the screenshot + message formatting.

```typescript
describe('Cart verification @regression @android-only', () => {
  let cartScreen: CartScreen;
  let softAssertions: string[];

  beforeEach(async () => {
    cartScreen = new CartScreen(browser);
    softAssertions = [];
  });

  it('Cart shows correct items @regression', async () => {
    // ... setup steps ...

    // VERIFY_SOFT: Cart badge shows "2"
    try {
      expect(await cartScreen.getCount('cartBadge')).toBe(2);
    } catch (err) {
      softAssertions.push(await cartScreen.recordSoftFailure('cart-badge', err));
    }

    // VERIFY_SOFT: Subtotal is "$29.98"
    try {
      expect(await cartScreen.getText('subtotal')).toBe('$29.98');
    } catch (err) {
      softAssertions.push(await cartScreen.recordSoftFailure('subtotal', err));
    }

    if (softAssertions.length > 0) {
      throw new Error(
        `${softAssertions.length} soft assertion(s) failed:\n` + softAssertions.join('\n'),
      );
    }
  });
});
```

**MANDATORY:** `softAssertions` MUST be re-initialized in `beforeEach` so failures from one scenario don't bleed into the next. The final throw MUST be the LAST statement of the `it()` block.

**Reviewer check:** A mobile spec containing a `VERIFY_SOFT` step MUST declare `softAssertions: string[]` at the describe scope, reset it in `beforeEach`, and end every test that contains any VERIFY_SOFT with the conditional throw. Each `try/catch` MUST call `recordSoftFailure()` (NOT a custom screenshot — this guarantees the standard label format).

---

### DATASETS — Mobile Pattern

```typescript
import testData from '../../../test-data/mobile/login-datasets.json';
import { browser } from '@wdio/globals';
import { LoginScreen } from '../../../screens/LoginScreen';
import { HomeScreen } from '../../../screens/HomeScreen';

describe('Login — data-driven @regression @android-only', () => {
  for (const data of testData) {
    it(`Login: ${data.username || '(empty)'} — expects ${data.expectedResult} @regression`, async () => {
      const loginScreen = new LoginScreen(browser);
      await loginScreen.typeText('emailInput', data.username);
      await loginScreen.typeText('passwordInput', data.password);
      await loginScreen.tap('signInButton');

      if (data.expectedResult === 'success') {
        const homeScreen = new HomeScreen(browser);
        expect(await homeScreen.isVisible('welcomeMessage')).toBe(true);
      } else {
        expect(await loginScreen.getText('errorMessage')).toContain(data.expectedError);
      }
    });
  }
});
```

**MANDATORY:** The `for...of` loop MUST be inside `describe()` and outside `it()`. Each row produces ONE separate `it()` block. The Mocha runner discovers them at file load time.

---

### SHARED_DATA — Mobile Pattern

The shared `output/core/test-data-loader.ts` is plain TypeScript with `fs.readFileSync` — no Playwright dependency — so it works in WDIO specs unchanged.

```typescript
// SHARED_DATA: users, products
import { loadTestData } from '../../../core/test-data-loader';
const testData = loadTestData('mobile/flipkart-cart', ['mobile-users', 'products']);
// testData merges shared/mobile-users.json + shared/products.json + mobile/flipkart-cart.json
```

**Reviewer check:** A mobile spec using `SHARED_DATA` MUST import from `core/test-data-loader` (relative path traverses three levels up: `../../../core/test-data-loader`). Direct JSON imports are forbidden.

---

### USE_HELPER — Mobile Pattern

```typescript
// USE_HELPER: FlipkartHomeScreen.dismissLoginPrompt
import { FlipkartHomeScreen } from '../../../screens/FlipkartHomeScreen';
import { applyHelpers } from '../../../screens/FlipkartHomeScreen.helpers';

const homeScreen = applyHelpers(new FlipkartHomeScreen(browser));
await homeScreen.dismissLoginPrompt();
```

The helper file lives at `output/screens/{ScreenName}.helpers.ts` and exports an `applyHelpers(screen)` function (or extends the class). The Builder MUST NOT create or modify helper files — they are team-owned.

**`@steps` for mobile helpers:** The same `@steps` JSDoc convention applies to mobile helpers. The Explorer (via Appium MCP) walks the `@steps` in the live app for state advancement — no element capture. Use mobile-appropriate action language in the `@steps` block (Tap instead of Click, Swipe instead of Scroll).

```typescript
/**
 * @steps
 * 1. Tap "Not Now" or "Later" if a login prompt appears
 * 2. Tap the close button if a promotional banner is visible
 * 3. VERIFY: The home screen search bar is visible
 */
export function dismissLoginPrompt(screen: FlipkartHomeScreenWithHelpers): Promise<void> {
  // ... implementation
}
```

**HARD STOP:** Same as web — if the helpers file does not exist or the method is missing:
- Do NOT create the helpers file
- Emit warning: `// WARNING: USE_HELPER requested FlipkartHomeScreen.dismissLoginPrompt but FlipkartHomeScreen.helpers.ts not found`
- Mark the spec with `it.skip('MISSING HELPER: FlipkartHomeScreen.dismissLoginPrompt', ...)`

---

### Running Multiple Mobile Specs in One Command

For enterprise mobile suites (20+ specs), the standard pattern is a single `wdio run` invocation that picks up all specs from `tests/mobile/**/*.spec.ts`. The `wdio.conf.ts` template's `specs` glob already matches the entire mobile tree.

```bash
# Run ALL mobile specs in one shot
PLATFORM=android npx wdio run wdio.conf.ts

# Filter by tag (Mocha grep — mobile tags live in describe/it title strings)
PLATFORM=android npx wdio run wdio.conf.ts --mochaOpts.grep "@smoke"
PLATFORM=android npx wdio run wdio.conf.ts --mochaOpts.grep "@P0"

# Run a subtree
PLATFORM=android npx wdio run wdio.conf.ts --spec 'tests/mobile/flipkart/**/*.spec.ts'

# Run multiple explicit specs (no contamination — see beforeSuite hook below)
PLATFORM=android npx wdio run wdio.conf.ts \
  --spec tests/mobile/flipkart/flipkart-add-to-cart.spec.ts \
  --spec tests/mobile/parity/test-lifecycle-hooks.spec.ts
```

**Why this works without per-spec contamination:** `wdio.conf.ts` includes a `beforeSuite` hook that calls `terminateApp` + `activateApp` on `process.env.APP_PACKAGE` before every spec file. With `NO_RESET=true` (required for fast real-device runs), Appium does NOT relaunch the app at session start — it just attaches to whatever the device is currently showing. The `beforeSuite` hook explicitly forces the app back to its launch state regardless of where the previous spec, a prior test run, or normal device usage left things. ~1s per spec on a real device, vs ~15s for a full session restart with `NO_RESET=false`.

**Failure isolation:** WDIO's default `bail: 0` means a failing spec does NOT stop subsequent specs — the worker continues through the entire `specs` list and reports per-spec pass/fail at the end. If you want to stop on first failure (e.g. smoke gate), set `bail: 1` in `wdio.conf.ts`.

**Multi-device parallelism:** WDIO uses the `capabilities: [...]` array — one entry per device. Default behavior is parallel cross-device coverage (each capability runs the FULL spec list, NOT sharding). For sharded speed-up across N devices, run N parallel WDIO processes each with `--shard X/N`. The `beforeSuite` reset still applies per-device because WDIO assigns each capability its own worker + session.

#### Multi-Device Capabilities — Patterns

**Local lab (multiple ADB-connected devices):** drive the capabilities array from an env var. Pass a comma-separated list of device serials and the framework expands them.

```typescript
// output/core/capabilities.ts (or wdio.conf.ts inline)
const deviceSerials = (process.env.ANDROID_DEVICES || process.env.ANDROID_DEVICE || '').split(',').filter(Boolean);

export function getAndroidCapabilities() {
  return deviceSerials.map(serial => ({
    platformName: 'Android',
    'appium:automationName': 'UIAutomator2',
    'appium:deviceName': serial,
    'appium:appPackage': process.env.APP_PACKAGE,
    'appium:appActivity': process.env.APP_ACTIVITY,
    'appium:noReset': process.env.NO_RESET === 'true',
    'appium:autoGrantPermissions': true,
  }));
}

// wdio.conf.ts
import { getAndroidCapabilities } from './core/capabilities';
export const config = {
  maxInstances: 3,                       // parallel session count cap
  capabilities: getAndroidCapabilities(),
  // ... rest of config
};
```

```bash
ANDROID_DEVICES=R5CT12345,R5CT67890,R5CT99999 PLATFORM=android npx wdio run wdio.conf.ts
```

**BrowserStack App Automate:** add `@wdio/browserstack-service`, set `BROWSERSTACK_USERNAME` + `BROWSERSTACK_ACCESS_KEY` env vars, and list device combinations explicitly in `capabilities`.

```typescript
// wdio.conf.ts
export const config = {
  user: process.env.BROWSERSTACK_USERNAME,
  key: process.env.BROWSERSTACK_ACCESS_KEY,
  services: [
    ['browserstack', { app: 'bs://<app-id-from-upload>', browserstackLocal: false }],
  ],
  capabilities: [
    {
      platformName: 'Android',
      'bstack:options': {
        deviceName: 'Google Pixel 8',
        osVersion: '14.0',
        projectName: 'agentic-qe',
        buildName: 'mobile-regression-${BUILD_NUMBER}',
        sessionName: 'flipkart-checkout',
        appiumVersion: '2.0.1',
      },
    },
    {
      platformName: 'Android',
      'bstack:options': {
        deviceName: 'Samsung Galaxy S23',
        osVersion: '13.0',
        projectName: 'agentic-qe',
        buildName: 'mobile-regression-${BUILD_NUMBER}',
        appiumVersion: '2.0.1',
      },
    },
    {
      platformName: 'iOS',
      'xcuitest:options': { deviceName: 'iPhone 15', osVersion: '17.0' },
      'bstack:options': { projectName: 'agentic-qe', appiumVersion: '2.0.1' },
    },
  ],
};
```

Upload the APK once via `curl -u "$BS_USER:$BS_KEY" -X POST "https://api-cloud.browserstack.com/app-automate/upload" -F "file=@app.apk"` — the response gives the `bs://<app-id>` to put in the `app` key above.

**Sauce Labs:** identical structure, different vendor key + service name. Use `'sauce:options'` instead of `'bstack:options'` and `services: ['sauce']`. Auth: `SAUCE_USERNAME` + `SAUCE_ACCESS_KEY`. App upload via Sauce's `storage:filename=app.apk` convention.

```typescript
services: ['sauce'],
capabilities: [
  {
    platformName: 'Android',
    'appium:app': 'storage:filename=app.apk',
    'sauce:options': {
      deviceName: 'Google Pixel 8',
      platformVersion: '14.0',
      appiumVersion: '2.0.1',
      build: 'mobile-regression-${BUILD_NUMBER}',
      name: 'flipkart-checkout',
    },
  },
],
```

**LambdaTest:** same again — vendor key is `'lt:options'`, service is `wdio-lambdatest-service` (community package, not `@wdio/`-scoped). Auth: `LT_USERNAME` + `LT_ACCESS_KEY`. App upload via LambdaTest's app upload API returns an `lt://APP_ID` reference.

```typescript
services: ['lambdatest'],
capabilities: [
  {
    platformName: 'Android',
    'appium:app': 'lt://APP10160541716...',
    'lt:options': {
      deviceName: 'Pixel 8',
      platformVersion: '14',
      appiumVersion: '2.0.1',
      project: 'agentic-qe',
      build: 'mobile-regression-${BUILD_NUMBER}',
      name: 'flipkart-checkout',
    },
  },
],
```

**The pattern is identical across BrowserStack, Sauce Labs, and LambdaTest.** You enumerate device combinations in `capabilities`, each entry uses a vendor-specific options key, and a WDIO service handles the cloud connection + result reporting. Default WDIO behavior applies: each capability runs the FULL spec list in parallel (cross-device coverage). For sharding, use `--shard X/N` from N parallel CI jobs.

**AWS Device Farm is different** — you don't list devices in `capabilities`. You package your test project as a zip, upload it, and select a named device pool managed in the AWS console. Device Farm runs the same bundle across every device in the pool. WDIO doesn't integrate directly; use the `aws devicefarm` CLI or SDK from a CI job. The framework `wdio.conf.ts` doesn't need any changes for this pattern.

**The `beforeSuite` reset hook works on every cloud provider** because it operates on the `browser` global, which is the per-session WebDriver client. Whether the session is on `localhost:4723` or a cloud endpoint, `terminateApp` + `activateApp` are standard Appium commands that all major mobile clouds support.
