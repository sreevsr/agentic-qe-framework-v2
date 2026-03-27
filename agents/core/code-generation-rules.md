# Code Generation Rules — Explorer-Builder Reference

**This file is MANDATORY reading for the Explorer-Builder. DO NOT generate any code without reading this file first.**

---

## 1. Locator JSON Format — MANDATORY for ALL Web/Hybrid Scenarios

Every element you interact with MUST have an entry in a locator JSON file.

**File location:** `output/locators/{page-name}.locators.json`

**Format — EVERY entry MUST have primary + at least 2 fallbacks:**

```json
{
  "submitButton": {
    "primary": "[data-testid='submit-btn']",
    "fallbacks": [
      "#submit-button",
      "button:has-text('Submit')"
    ]
  },
  "usernameInput": {
    "primary": "[data-testid='username']",
    "fallbacks": [
      "#username",
      "input[name='username']"
    ]
  }
}
```

**Rules — NO EXCEPTIONS:**
- Primary selector = the one that WORKED during live exploration
- **MUST** include at least 2 fallback selectors using different strategies
- Use descriptive camelCase element names
- One locator file per page object
- **NEVER** put selectors directly in page objects or spec files

---

## 2. Page Object Structure — MANDATORY

**File location:** `output/pages/{PageName}Page.ts`

```typescript
import { Page } from '@playwright/test';
import { BasePage } from '../core/base-page';

export class LoginPage extends BasePage {
  constructor(page: Page) {
    super(page, 'login-page.locators.json');
  }

  async fillUsername(username: string): Promise<void> {
    await this.page.locator(this.loc.get('usernameInput')).fill(username);
  }

  async clickLogin(): Promise<void> {
    await this.page.locator(this.loc.get('loginButton')).click();
  }

  async getErrorMessage(): Promise<string> {
    return (await this.page.locator(this.loc.get('errorMessage')).textContent()) ?? '';
  }
}
```

**Rules — MUST follow ALL:**
- **MUST** extend `BasePage`
- **MUST** pass the locator file name to `super()` constructor
- **MUST** access all selectors via `this.loc.get('elementName')` — NO raw selectors
- Methods MUST be async with descriptive names: `fill*`, `click*`, `get*`, `is*`, `select*`, `wait*`
- Getter methods (for CAPTURE) MUST return the value
- One page object per distinct page/view
- **MUST** check if page object already exists before creating — REUSE existing, ADD methods if needed
- **MUST** check for `*.helpers.ts` files — if `LoginPage.helpers.ts` exists, import `LoginPageWithHelpers as LoginPage` in the spec

---

## 3. Spec File Structure — MANDATORY

**File location:** `output/tests/{type}/[{folder}/]{scenario}.spec.ts`

```typescript
import { test, expect } from '@playwright/test';
import { LoginPage } from '../../pages/LoginPage';

// CAPTURE variables — MUST be declared in outer scope with let
let capturedValue: string;

test.describe('{Feature Name}', () => {
  test('{Scenario Name}', { tag: ['@smoke', '@P0'] }, async ({ page }) => {
    const loginPage = new LoginPage(page);

    await test.step('Step 1 — Navigate to login page', async () => {
      await loginPage.goto(process.env.BASE_URL!);
    });

    await test.step('Step 2 — Enter username', async () => {
      await loginPage.fillUsername(process.env.TEST_USERNAME!);
    });

    await test.step('Step 3 — VERIFY: Login successful', async () => {
      await expect(page).toHaveURL(/\/dashboard/);
    });
  });
});
```

**Rules — HARD STOP on each:**

1. **EVERY step MUST be wrapped in `await test.step('Step N — {description}', async () => { ... })`** — unwrapped code is a FAILURE
2. **Step numbers MUST be sequential** (1, 2, 3...) — positional count, NOT the user's original numbers
3. **Step descriptions MUST match the scenario intent** — DO NOT paraphrase to change meaning. **MUST use template literals** for runtime values: `` `Step 8 — Lookup ${testData.customerName}` `` — so the HTML report shows real data, not placeholder text
4. **CAPTURE variables MUST be declared with `let` in the OUTER test scope** — NOT inside test.step. This is a Playwright scoping requirement.
5. **Tags MUST have `@` prefix:** `{ tag: ['@smoke', '@P0'] }`
6. **All `{{ENV.VARIABLE}}` MUST become `process.env.VARIABLE`** — NEVER hardcode values
7. **DO NOT add steps that are not in the scenario** — the spec is a faithful translation, not an enhancement
8. **DO NOT combine, merge, or simplify steps** — every scenario step = one test.step block

---

## 4. Keyword → Code Patterns — MANDATORY Reference

**HARD STOP: For each keyword, you MUST produce EXACTLY the code pattern shown. Read `agents/shared/keyword-reference.md` for the full, authoritative reference. This is the quick reference.**

### VERIFY (Hard Assertion)
```typescript
// VERIFY: Cart badge shows "2"
expect(await inventoryPage.getCartBadgeCount()).toBe(2);
```
**NEVER change expected values. If the element is found but shows the wrong value → `test.fixme('POTENTIAL BUG: ...')`**

### VERIFY_SOFT (Soft Assertion)
```typescript
// VERIFY_SOFT: Cart badge shows "2"
{
  const result = await inventoryPage.getCartBadgeCount();
  expect.soft(result).toBe(2);
  if (result !== 2) {
    const screenshot = await page.screenshot({ fullPage: true });
    await test.info().attach('VERIFY_SOFT-failed-cart-badge', {
      body: screenshot, contentType: 'image/png'
    });
  }
}
```
**MUST use block scope `{ }`. MUST auto-screenshot on failure. NEVER convert VERIFY to VERIFY_SOFT or vice versa.**

### CAPTURE
```typescript
// Outer scope
let subtotal: string;

// Inside test.step
await test.step('Step 5 — CAPTURE: Read subtotal', async () => {
  subtotal = await checkoutPage.getSubtotal();
});
```
**Variable MUST be `let` in outer scope, assigned inside step.**

### CALCULATE
```typescript
await test.step('Step 6 — CALCULATE: expectedTotal = subtotal + tax', async () => {
  const expectedTotal = (parseFloat(subtotal.replace('$', '')) +
    parseFloat(tax.replace('$', ''))).toFixed(2);
});
```

### SCREENSHOT
```typescript
await test.step('Step 7 — SCREENSHOT: checkout-overview', async () => {
  const screenshot = await page.screenshot({ fullPage: true });
  await test.info().attach('checkout-overview', {
    body: screenshot, contentType: 'image/png'
  });
});
```

### REPORT
**The step label with interpolated runtime value IS the primary report.** The HTML report shows step labels — use template literals so humans see real data, not placeholder names.
```typescript
await test.step(`Step 8 — REPORT: Subtotal=${subtotal}, Tax=${tax}, Total=${total}`, async () => {
  test.info().annotations.push({ type: 'subtotal', description: subtotal });
  test.info().annotations.push({ type: 'tax', description: tax });
  test.info().annotations.push({ type: 'total', description: total });
});
```
**MUST use template literals in step labels** — `Step 8 — Lookup ${testData.customerName}` not `Step 8 — Lookup {{customerName}}`. The HTML report shows real data this way.

### SAVE
```typescript
import { saveState } from '../core/shared-state';

await test.step('Step 9 — SAVE: orderNumber to shared-state', async () => {
  saveState('lastOrderNumber', orderNumber);
});
```

### DATASETS (Data-Driven)
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
      // ... use data.fieldName for parameterized values
    });
}
```
**MANDATORY: Explore using ONLY the first data row. Generate the loop covering ALL rows.**

### SHARED_DATA
```typescript
import { loadTestData } from '../../core/test-data-loader';
const testData = loadTestData('web/saucedemo-checkout', ['users', 'products']);
```

### USE_HELPER
```typescript
// If helper exists:
import { CartPageWithHelpers as CartPage } from '../pages/CartPage.helpers';
const cartTotal = await cartPage.calculateTotalPrice();

// If helper does NOT exist:
// WARNING: USE_HELPER requested CartPage.calculateTotalPrice but helpers file not found
test.fixme('MISSING HELPER: CartPage.calculateTotalPrice');
```
**HARD STOP: NEVER create `*.helpers.ts` files. They are team-owned.**

### API Steps
```typescript
await test.step('Step 4 — API POST: Create user', async () => {
  const response = await request.post(`${process.env.API_BASE_URL}/users`, {
    data: { name: 'Test User' },
    headers: { Authorization: `Bearer ${process.env.API_TOKEN}` },
  });
  expect(response.status()).toBe(201);
});
```
**MUST use Playwright `request` fixture. NEVER use `fetch` or `axios`. MUST assert status code.**

### Tags
```typescript
test('Scenario name', { tag: ['@smoke', '@cart', '@P0'] }, async ({ page }) => { ... });
```
**MUST have `@` prefix. Every test MUST have tags.**

---

## 5. Multi-Assertion VERIFY — Nested test.step Pattern

When a single VERIFY step checks multiple sub-assertions (e.g., "VERIFY: Order summary shows correct subtotal, tax, and total"), **MUST** use nested `test.step()` for each sub-assertion. This makes the HTML report pinpoint exactly which field failed:

```typescript
await test.step('Step 10 — VERIFY: Order summary is correct', async () => {
  await test.step('Verify subtotal', async () => {
    expect(await summaryPage.getSubtotal()).toBe(expectedSubtotal);
  });
  await test.step('Verify tax', async () => {
    expect(await summaryPage.getTax()).toBe(expectedTax);
  });
  await test.step('Verify total', async () => {
    expect(await summaryPage.getTotal()).toBe(expectedTotal);
  });
});
```

**Why:** Without nesting, a single `test.step` with 3 `expect()` calls shows "Step 10 failed" but doesn't say WHICH assertion. With nesting, the report shows "Step 10 > Verify tax — failed."

---

## 6. Chart and Graph Assertions

### SVG Charts (Readable)
SVG charts render as DOM elements — axis labels, data values, and legends are readable via `<text>` nodes:

```typescript
// SVG chart — read data labels
const labels = await page.locator('svg text.data-label').allTextContents();
expect(labels).toContain('Q1: $45,000');
```

### Canvas Charts (NOT Readable)
Canvas charts render as a single bitmap — **NEVER attempt to read pixel data or internal values.** Only these assertions are possible:

```typescript
// Canvas chart — ONLY these are valid
await expect(page.locator('canvas.chart')).toBeVisible(); // chart rendered
const title = await page.locator('.chart-title').textContent(); // title/legend outside canvas
expect(title).toContain('Revenue');
```

**If the scenario requires asserting chart DATA and the chart is Canvas:** Use the API endpoint that feeds the chart. Assert the API response instead of the visual chart. This is more reliable.

**If you cannot determine SVG vs Canvas during exploration:** Take a snapshot. If the element is `<svg>`, it's SVG. If `<canvas>`, it's Canvas. Record this in app-context.

---

## 7. Conditional Steps ("If...Then")

When a scenario step contains a condition (e.g., "If pagination exists, navigate to page 2"):

### During Exploration
1. Check the condition in the live browser (e.g., is pagination visible?)
2. If the condition is TRUE → explore and verify the action, write both the condition check AND the action
3. If the condition is FALSE → write the condition check code that SKIPS the action. Note in the explorer report that the condition was false during exploration

### Code Pattern — MANDATORY
```typescript
await test.step('Step 11 — If pagination exists, navigate to page 2', async () => {
  const hasPagination = await page.locator('[data-testid="pagination"]').isVisible().catch(() => false);
  if (hasPagination) {
    await page.locator('[data-testid="page-2"]').click();
    await page.waitForLoadState('networkidle');
  } else {
    console.log('Pagination not present — skipping page 2 navigation');
  }
});
```

**Rules:**
- **MUST** use `.isVisible().catch(() => false)` for existence checks — handles element not in DOM
- **MUST** wrap the entire condition + action in ONE `test.step()` — the conditional IS the step
- **MUST NOT** skip the step entirely if condition is false — the step exists, it just takes the "else" path
- **MUST NOT** use `test.fixme()` for false conditions — the step executed correctly, the condition was simply false
- For VERIFY after conditional action: assert ONLY if the action was taken:
  ```typescript
  await test.step('Step 12 — VERIFY: Page 2 shows Sports results', async () => {
    if (hasPagination) {
      const results = await gridPage.getAllSpecialties();
      expect(results.every(r => r.includes('Sports'))).toBe(true);
    } else {
      console.log('Pagination not present — VERIFY skipped (condition was false)');
    }
  });
  ```

---

## 8. API CRUD Chain Pattern

For create-read-update-delete sequences:

```typescript
let resourceId: string;

await test.step('Step 1 — API POST: Create user', async () => {
  const response = await request.post(`${process.env.API_BASE_URL}/users`, {
    data: { name: 'Test User' }
  });
  expect(response.status()).toBe(201);
  const body = await response.json();
  resourceId = body.id;
});

await test.step('Step 2 — API GET: Verify user exists', async () => {
  const response = await request.get(`${process.env.API_BASE_URL}/users/${resourceId}`);
  expect(response.status()).toBe(200);
});

await test.step('Step 3 — API DELETE: Remove user', async () => {
  const response = await request.delete(`${process.env.API_BASE_URL}/users/${resourceId}`);
  expect(response.status()).toBe(200);
});
```

**CRUD Persistence Guardrail — MANDATORY unless `## API Behavior: mock`:**
- POST returns 2xx → subsequent GET MUST find the resource. If GET returns 404 → `test.fixme('POTENTIAL BUG: POST returned 201 but resource not found')`
- PUT returns 2xx → subsequent GET MUST show updated values
- DELETE returns 2xx → subsequent GET MUST return 404

---

## 8. Selector Externalization — HARD STOP

**EVERY selector MUST live in a locator JSON file. NO EXCEPTIONS.**

- Page objects use `this.loc.get('elementName')` — NEVER raw `page.locator('css-selector')`
- Spec files NEVER contain selectors — they call page object methods
- The ONLY place selectors appear is in `output/locators/*.locators.json`

If you find yourself writing a selector directly in a page object or spec file — **STOP. Move it to the locator JSON first.**

---

## 9. Reusing Existing Code — MANDATORY Checks

Before creating ANY new file, you MUST check if it already exists:

1. **Page object exists?** → REUSE it. ADD new methods if needed. DO NOT create a duplicate.
2. **Locator file exists?** → ADD new entries. DO NOT overwrite existing entries.
3. **Helpers file exists?** (`*.helpers.ts`) → Import the helpers class, NOT the base class. NEVER modify helpers.
4. **Shared data exists?** (`test-data/shared/`) → NEVER modify. Create scenario-specific overrides instead.

---

## 10. Browser Interaction via MCP

The Explorer-Builder uses the Playwright MCP server. Exact tool names depend on the server implementation, but operations map to:

| Operation | What It Does | When to Use |
|-----------|-------------|-------------|
| Navigate | Open URL | Navigation steps |
| Snapshot | Get page state (DOM/accessibility tree) | Before identifying elements |
| Click | Click element by selector | Interaction steps |
| Fill | Type text into input | Input steps |
| Screenshot | Capture visual state | On failure or SCREENSHOT keyword |
| Evaluate | Run JavaScript in page | Custom waits, data extraction |

**Token efficiency:** Prefer accessibility tree snapshot over full DOM. Only request full DOM when accessibility tree lacks needed information (SVG elements, custom attributes).

---

## 11. Lifecycle Hook Rules — HARD STOP

### beforeAll / afterAll — `{ browser }` ONLY

**NEVER use `{ page }` or `{ request }` in beforeAll/afterAll. This is a Playwright constraint.**

```typescript
test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage();
  // ... setup steps ...
  await page.close();
});
```

For API calls in beforeAll:
```typescript
const { request: playwrightRequest } = require('@playwright/test');
test.beforeAll(async ({ browser }) => {
  const ctx = await playwrightRequest.newContext();
  // ... API steps ...
  await ctx.dispose();
});
```

### beforeEach / afterEach — per type fixture

| Type | Fixture |
|------|---------|
| web | `{ page }` |
| api | `{ request }` |
| hybrid | `{ page, request }` |

### Step Labels in Lifecycle Hooks

**MUST use semantic prefixes, NOT step numbers:**
```typescript
await test.step('[Setup] Navigate to app', async () => { ... });
await test.step('[Before Each] Login', async () => { ... });
await test.step('[After Each] Clear cart', async () => { ... });
await test.step('[After All] Cleanup data', async () => { ... });
```

Main scenario steps use sequential numbers: `Step 1`, `Step 2`, etc.
