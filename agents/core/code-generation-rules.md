# Code Generation Rules — Builder Reference

**This file is MANDATORY reading for the Builder agent. DO NOT generate any code without reading this file first.**

**Note:** In the previous architecture, the Explorer-Builder (legacy) combined exploration and code generation. In the current architecture, the Explorer captures element selectors from the MCP snapshot (with `browser_evaluate()` DOM probe for non-accessible elements) and embeds them in the enriched.md as `<!-- ELEMENT: {...} -->` annotations. The Builder extracts these annotations to create locator JSONs and generate code. The Builder has NO browser access — all selectors come from Explorer-captured ELEMENT annotations.

## 0. Language Selection — MANDATORY First Check

**BEFORE generating any code, determine the target language:**

1. Read `output/.language` file — it contains `typescript`, `javascript`, or `python`
2. If file doesn't exist → default to `typescript`
3. Read the language profile: `templates/languages/{language}.profile.json`
4. The profile defines: naming conventions, assertion syntax, file extensions, import patterns, fixture patterns

**ALL code generation rules in this file show TypeScript examples by default.** When generating for other languages, adapt using the language profile:

| Aspect | TypeScript | JavaScript | Python |
|--------|-----------|------------|--------|
| File extension | `.ts` | `.js` | `.py` |
| Spec naming | `{scenario}.spec.ts` | `{scenario}.spec.js` | `test_{scenario}.py` |
| Page object | `{Page}Page.ts` | `{Page}Page.js` | `{page}_page.py` |
| Class export | `export class` | `class ... module.exports` | `class` |
| Imports | `import { X } from 'Y'` | `const { X } = require('Y')` | `from Y import X` |
| Async model | `async/await` | `async/await` | **Sync** (no async/await) |
| Assertions | `expect(loc).toHaveText()` | `expect(loc).toHaveText()` | `expect(loc).to_have_text()` |
| Env vars | `process.env.X` | `process.env.X` | `os.environ["X"]` |
| Method naming | `camelCase` | `camelCase` | `snake_case` |
| Step wrapper | `test.step('Step N', ...)` | `test.step('Step N', ...)` | `# Step N — {label}` (comment) |
| Capture vars | `let x: string` | `let x` | `x = None` |

**CRITICAL for Python:**
- Sync API by default — NO `async/await`
- Methods are `snake_case`
- NO `test.step()` equivalent — use `# Step N — {label}` comments as step markers
- Use `pytest.mark.{tag}` decorators for tags instead of `{ tag: [...] }`
- **NO `expect.soft()`** — for VERIFY_SOFT, collect assertion errors without stopping:
  ```python
  # VERIFY_SOFT: Cart badge shows "2"
  soft_errors = []
  try:
      expect(page.locator(loc.get("cart_badge"))).to_have_text("2")
  except AssertionError as e:
      soft_errors.append(str(e))
      page.screenshot(path=f"screenshots/VERIFY_SOFT-failed-cart-badge.png")
  # At end of test: assert not soft_errors, f"Soft assertions failed: {soft_errors}"
  ```
- **SCREENSHOT attach:** Use `page.screenshot(path="screenshots/{name}.png")` — no `test.info().attach()` in pytest. Use `pytest-html` plugin for report attachments
- **REPORT:** Use `print()` for console output + custom pytest fixture for structured reporting

---

## 1. Locator JSON Format — MANDATORY for ALL Web/Hybrid Scenarios

Every element you interact with MUST have an entry in a locator JSON file.

**File location:** `output/locators/{page-name}.locators.json`

**Format — EVERY entry MUST have primary + at least 2 fallbacks + type:**

```json
{
  "submitButton": {
    "primary": "role=button[name='Submit']",
    "fallbacks": [
      "[data-testid='submit-btn']",
      "#submit-button"
    ],
    "type": "button"
  },
  "usernameInput": {
    "primary": "label=Username",
    "fallbacks": [
      "[data-testid='username']",
      "input[name='username']"
    ],
    "type": "input"
  }
}
```

**Rules — NO EXCEPTIONS:**
- Primary selector = extracted from the Explorer's `<!-- ELEMENT: {...} -->` annotation (`primary` field). The Explorer captured this from the MCP snapshot or DOM probe during live exploration. Use semantic prefixes (`role=`, `label=`, `testid=`, `text=`) — the LocatorLoader resolves them automatically
- **MUST** include at least 2 fallback selectors (from the ELEMENT annotation's `fallbacks` array)
- **MUST** include `type` field (`input` | `button` | `link` | `select` | `checkbox` | `radio` | `text` | `image` | `structural`) — helps Reviewer verify correct interaction patterns
- Use descriptive camelCase element names (from the ELEMENT annotation's `key` field)
- One locator file per page object
- **NEVER** put selectors directly in page objects or spec files
- Selector priority (set by the Explorer during capture): data-testid > stable ID > href > native role+text > text > CSS. The Builder uses exactly what the Explorer captured — do NOT override.

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

### BasePage vs PageObject — Method Placement Binary Test

**Before adding ANY method, apply this test:**

Does the method contain ANY of these?
- A CSS selector or element ID
- `page.locator()` with a specific selector
- `page.evaluate()` with DOM manipulation
- `frameLocator()` for a specific iframe
- `pressSequentially`/`fill`/`click` on a specific element
- Any app-specific or page-specific logic

**If YES → method belongs in `{PageName}Page.ts` (the page object), NOT `core/base-page.ts`.**

**If NO → method is generic and belongs in `core/base-page.ts`.**

BasePage MUST remain generic — it works for ANY app. Page objects contain app-specific logic.

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
      console.log(`[${new Date().toISOString()}] Step 1 — Navigate to login page`);
      await loginPage.goto(process.env.BASE_URL!);
    });

    await test.step('Step 2 — Enter username', async () => {
      console.log(`[${new Date().toISOString()}] Step 2 — Enter username`);
      await loginPage.fillUsername(process.env.TEST_USERNAME!);
    });

    await test.step('Step 3 — VERIFY: Login successful', async () => {
      console.log(`[${new Date().toISOString()}] Step 3 — VERIFY: Login successful`);
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
9. **EVERY `test.step()` MUST begin with a `console.log` as the first line inside the block** — this provides real-time terminal visibility during test execution and CI/CD pipeline logs. Format: `` console.log(`[${new Date().toISOString()}] Step N — {description}`) ``. Use template literals for runtime values so the log shows actual data. This rule applies to ALL scenario types that use `test.step()` (web, api, hybrid). For mobile/Mocha patterns see §16 below.

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

### Test Data Usage Rule — MANDATORY

**If a test-data JSON file is generated** (`output/test-data/{type}/{scenario}.json`), the spec file **MUST import and use it.** Dead test data files — generated but never imported — are a code quality violation.

```typescript
// CORRECT — import and use test data
import testData from '../../test-data/web/scenario-name.json';
// Then use: testData.firstName, testData.address, etc.
```

All hardcoded values in the spec that correspond to fields in the test data JSON MUST be replaced with `testData.fieldName` references. This ensures the spec is data-driven and the test data file serves its intended purpose.

**Exception:** `process.env.*` values (credentials, URLs) do NOT come from test data — they come from `.env`.

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

## 7. Grid Row Scoping — Avoiding Strict Mode Violations

When interacting with elements INSIDE grid/table rows (buttons, links, checkboxes in a row), Playwright's strict mode will fail with "locator resolved to N elements" if the selector matches across multiple rows.

**MANDATORY: Use two-step scoped locators for in-row elements:**

```typescript
// WRONG — matches the "Edit" button in EVERY row → strict mode violation
await page.locator('button:has-text("Edit")').click();

// CORRECT — scope to the specific row first, then find the element within it
const row = page.locator('tr', { hasText: targetData });
await row.locator('button:has-text("Edit")').click();

// CORRECT — using data-testid row anchor
const row = page.locator(`[data-row-id="${rowId}"]`);
await row.locator('[data-testid="delete-btn"]').click();
```

**Locator JSON for row-scoped elements:**
```json
{
  "dataGrid": {
    "primary": "[data-testid='data-grid']",
    "fallbacks": ["table.data-table", ".grid-container"],
    "type": "table"
  },
  "editButton": {
    "primary": "button:has-text('Edit')",
    "fallbacks": ["[data-testid='edit-btn']", ".btn-edit"],
    "type": "button",
    "scope": "row"
  }
}
```

The `"scope": "row"` field signals that this element MUST be accessed via a row-scoped locator chain, NOT directly. The page object method MUST accept a row identifier:

```typescript
async clickEditInRow(rowText: string): Promise<void> {
  const row = this.page.locator('tr', { hasText: rowText });
  await row.locator(this.loc.get('editButton')).click();
}
```

---

## 8. Comment Conventions — FRAGILE and PACING

### `// FRAGILE:` Convention

Mark selectors or code paths that use fragile strategies (page.evaluate text-walkers, inferred selectors without data-testid, deep CSS paths) with a `// FRAGILE:` comment:

```typescript
// FRAGILE: No data-testid on this element — uses text content which may change with i18n
async getStatusText(): Promise<string> {
  return await this.page.locator('.status-container > span:first-child').textContent() ?? '';
}

// FRAGILE: Uses page.evaluate to walk DOM text nodes — breaks if DOM structure changes
async getCellValue(row: number, col: number): Promise<string> {
  return await this.page.evaluate(([r, c]) => {
    const cell = document.querySelectorAll('table tbody tr')[r]?.querySelectorAll('td')[c];
    return cell?.textContent?.trim() ?? '';
  }, [row, col]);
}
```

**The `// FRAGILE:` comment signals to the Reviewer (Dim 1) and humans that this code needs attention.** It is NOT a failure — sometimes fragile is the only option. But it MUST be documented.

### `// PACING:` Convention (recap)

Already documented in quality-gates.md — protects justified `waitForTimeout` calls from Reviewer removal.

---

## 9. Conditional Steps ("If...Then")

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

## 10. API CRUD Chain Pattern

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

## 11. Selector Externalization — HARD STOP

**EVERY selector MUST live in a locator JSON file. NO EXCEPTIONS.**

- Page objects use `this.loc.get('elementName')` — NEVER raw `page.locator('css-selector')`
- Spec files NEVER contain selectors — they call page object methods
- The ONLY place selectors appear is in `output/locators/*.locators.json`

If you find yourself writing a selector directly in a page object or spec file — **STOP. Move it to the locator JSON first.**

### LocatorLoader-Only Base Rule — MANDATORY

**Every `page.locator()` call in a page object MUST use `this.loc.get('{elementName}')` or `this.loc.getLocator('{elementName}')` as its base.** Direct CSS/XPath strings passed to `page.locator()` in page objects bypass LocatorLoader and violate the externalization principle.

**Exception — row-scoped chaining:** When operating on a specific row within a table, list, or grid, the page object MAY chain `.locator()` and `.filter()` calls from a LocatorLoader-loaded base:

```typescript
// CORRECT — base from LocatorLoader, scoping inline
async getProductPrice(productName: string): Promise<string> {
  const table = this.page.locator(this.loc.get('cartTable'));
  const row = table.locator('tbody tr').filter({ hasText: productName });
  return (await row.locator(this.loc.get('cartProductPrice')).textContent()) ?? '';
}
```

The base element (`cartTable`) and the target element (`cartProductPrice`) both come from LocatorLoader. Only the structural scoping (`.locator('tbody tr').filter()`) is inline.

---

## 12. Structural Assertions — NEVER Use Data Values for Existence Checks — MANDATORY

**This is the automation engineer's mindset: verify STRUCTURE to confirm data exists, verify VALUES only when the scenario explicitly names them.**

### 12.1: Data Existence ≠ Data Match

When a scenario says **"widget is visible with data in the grid"**, it means: the grid has rendered and contains rows. It does NOT mean: check if a specific person's name appears.

```typescript
// ❌ WRONG — uses a specific person's name to check data exists. Breaks when data changes.
async isGridDataVisible(): Promise<boolean> {
  return await this.page.locator(this.loc.get('johnSmith')).isVisible();
}

// ✅ CORRECT — checks structural elements for data presence
async isGridDataVisible(): Promise<boolean> {
  const rowCount = await this.page.locator(this.loc.get('gridRows')).count();
  return rowCount > 0;
}

// ✅ ALSO CORRECT — checks that a cell in the first row has text content
async isGridDataVisible(): Promise<boolean> {
  const firstCell = this.page.locator(this.loc.get('gridFirstColumnCells')).first();
  const text = await firstCell.textContent();
  return text !== null && text.trim().length > 0;
}
```

**Rule: If the scenario says "data is visible" / "data is loaded" / "grid has data" — verify ROW COUNT > 0 or FIRST CELL HAS TEXT. NEVER check for a specific name, email, or phone number.**

### 12.2: Sort Verification — Read Dynamically, Don't Hardcode

When the scenario says **"sorted A–Z"** or **"sorted Z–A"**, verify the order programmatically:

```typescript
// ✅ CORRECT — reads all cells and verifies sort order dynamically
async verifyColumnSortedAscending(): Promise<boolean> {
  const cells = await this.page.locator(this.loc.get('gridFirstColumnCells')).allTextContents();
  const trimmed = cells.map(c => c.trim()).filter(c => c.length > 0);
  for (let i = 1; i < trimmed.length; i++) {
    if (trimmed[i].localeCompare(trimmed[i - 1]) < 0) return false;
  }
  return true;
}

// ❌ WRONG — hardcodes the expected first row from Explorer's DISCOVERED notes
expect(firstCell).toBe('Acme Corp'); // breaks when data changes
```

**Exception:** If the scenario ITSELF explicitly names an expected value (e.g., "VERIFY: first row shows 'Admin'"), then hardcoding that value is correct — it's a scenario requirement, not a data dependency.

### 12.3: Pagination — Parameterized Methods, Not Per-Page Methods

**NEVER create individual methods per page number.** An automation engineer builds ONE reusable method:

```typescript
// ❌ WRONG — one method per page, doesn't scale, hardcoded
async clickPageButton1(): Promise<void> { ... }
async clickPageButton2(): Promise<void> { ... }
async waitForPageButton1Active(): Promise<void> { ... }
async waitForPageButton2Active(): Promise<void> { ... }

// ✅ CORRECT — parameterized, reusable, works for any page count
async clickPageButton(pageNumber: number): Promise<void> {
  await this.page.getByRole('button', { name: String(pageNumber), exact: true }).click();
}

async waitForPageActive(pageNumber: number): Promise<void> {
  await expect(this.page.getByRole('button', { name: String(pageNumber), exact: true }))
    .toBeDisabled();
}

async isPageActive(pageNumber: number): Promise<boolean> {
  return await this.page.getByRole('button', { name: String(pageNumber), exact: true }).isDisabled();
}
```

**The spec then reads naturally:**
```typescript
await gridPage.clickPageButton(2);
await gridPage.waitForPageActive(2);
expect(await gridPage.isPageActive(2)).toBe(true);
```

Similarly for pagination with `waitForFunction` — use Playwright's built-in locator waits instead:

```typescript
// ❌ WRONG — raw document.querySelectorAll bypasses locator pattern
await this.page.waitForFunction(() => {
  const buttons = Array.from(document.querySelectorAll('button'));
  const btn = buttons.find(b => b.textContent?.trim() === '2');
  return btn?.disabled === true;
});

// ✅ CORRECT — uses Playwright locator API
await expect(this.page.getByRole('button', { name: '2', exact: true })).toBeDisabled();
```

### 12.4: Widget/Section Visibility — Use Structural Selectors

When verifying multiple widgets or sections exist on a page, use heading/container selectors — not data values inside them:

```typescript
// ❌ WRONG — verifies widget exists by checking if a specific person's name is visible
async isSectionGridDataVisible(): Promise<boolean> {
  return await this.page.locator(this.loc.get('johnSmith')).isVisible();
}

// ✅ CORRECT — verifies widget has rows with data
async isWidgetDataVisible(widgetLocatorKey: string): Promise<boolean> {
  const widget = this.page.locator(this.loc.get(widgetLocatorKey));
  const rows = widget.locator('tbody tr');
  return (await rows.count()) > 0;
}
```

### 12.5: Locator JSON — Structural Entries

When the Builder needs structural locators that weren't explicitly captured as individual ELEMENT annotations (e.g., `gridRows`, `gridFirstColumnCells`), it creates them in the locator JSON based on the structural ELEMENT annotations the Explorer captured (see Section 4.5 of explorer.md). Use descriptive names:

```json
{
  "gridRows": {
    "primary": "tbody tr",
    "fallbacks": ["table tbody tr", ".grid-body tr"],
    "type": "text",
    "notes": "All data rows in the grid table. Used for row count and data existence checks."
  },
  "gridFirstColumnCells": {
    "primary": "tbody tr td:first-child",
    "fallbacks": ["table tbody tr td:nth-child(1)"],
    "type": "text",
    "notes": "First column cells in all grid rows. Used for sort verification."
  }
}
```

---

## 13. Reusing Existing Code — MANDATORY Checks

Before creating ANY new file, you MUST check if it already exists:

1. **Page object exists?** → REUSE it. ADD new methods if needed. DO NOT create a duplicate.
2. **Locator file exists?** → ADD new entries. DO NOT overwrite existing entries.
3. **Helpers file exists?** (`*.helpers.ts`) → Import the helpers class, NOT the base class. NEVER modify helpers.
4. **Shared data exists?** (`test-data/shared/`) → NEVER modify. Create scenario-specific overrides instead.

---

## 14. Locator JSON Creation — How the Builder Extracts Element Data

**The Builder does NOT use MCP or open a browser.** All element selectors come from `<!-- ELEMENT: {...} -->` annotations that the Explorer embedded in the enriched.md during live browser exploration.

**The Builder's first task is to extract these annotations and create locator JSON files:**

```json
// Extracted from enriched.md ELEMENT annotations → output/locators/login-page.locators.json
{
  "signupEmailInput": {
    "primary": "testid=signup-email",
    "fallbacks": ["input[name='email']", "#signup-email"],
    "type": "input"
  }
}
```

The Builder generates code that uses `this.loc.get('signupEmailInput')` — NEVER the raw selector string. If a step has `<!-- ELEMENT_CAPTURE_FAILED -->`, generate `test.fixme('ELEMENT CAPTURE FAILED: ...')`.

**Every locator entry traces back to an ELEMENT annotation.** The Builder does not invent selectors. If the Explorer didn't capture an element, the Builder cannot create a locator for it.

---

## 15. Lifecycle Hook Rules — HARD STOP

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

---

## 16. Mobile Code Generation — MANDATORY for `mobile` and `mobile-hybrid` Types

**This entire section applies ONLY to mobile and mobile-hybrid types.** Web/api/hybrid types continue to use the Playwright patterns above.

### 16.1 Mobile Locator JSON Format

**File location:** `output/locators/mobile/{screen-name}.locators.json`

Mobile locators use a **platform-keyed** format — fundamentally different from the web format. Each element entry has `android` and/or `ios` sub-objects with strategy-specific selectors:

```json
{
  "goButton": {
    "android": {
      "accessibility_id": "Start a Speedtest",
      "id": "org.zwanoo.android.speedtest:id/go_button",
      "xpath": "//android.widget.Button[@content-desc='Start a Speedtest']"
    },
    "ios": {
      "accessibility_id": "Start a Speedtest",
      "class_chain": "**/XCUIElementTypeButton[`label == 'Start a Speedtest'`]"
    },
    "description": "Main GO button to start speed test",
    "type": "button"
  }
}
```

**Strategy priority (Android):** `accessibility_id` > `id` > `uiautomator` > `xpath`
**Strategy priority (iOS):** `accessibility_id` > `id` > `class_chain` > `predicate_string` > `xpath`

**Rules:**
- `accessibility_id` (content-desc on Android) is ALWAYS preferred — most stable across app updates
- `xpath` is LAST resort — NEVER use index-based xpath (`[3]`)
- `uiautomator` selectors for complex matching: `new UiSelector().textMatches("(?i)add to cart")`
- At minimum, `android` selectors MUST be present. `ios` is recommended for cross-platform.
- `MobileLocatorLoader` reads `process.env.PLATFORM` and resolves the correct platform branch at runtime

### 16.2 Screen Object Structure

**File location:** `output/screens/{ScreenName}Screen.ts`

```typescript
import { BaseScreen } from '../core/base-screen';

export class FlipkartHomeScreen extends BaseScreen {
  constructor(driver: WebdriverIO.Browser) {
    super(driver, 'flipkart-home-screen');
  }

  async waitForScreen(): Promise<void> {
    await this.waitForElement('cartTab', 'displayed', 20000);
  }

  async tapSearchBar(): Promise<void> {
    await this.tap('searchBar');
  }

  async getProductName(): Promise<string> {
    return this.getText('productName');
  }

  async isAddToCartVisible(): Promise<boolean> {
    return this.isVisible('addToCartButton');
  }
}
```

**Rules — MUST follow ALL:**
- **MUST** extend `BaseScreen` (NOT `BasePage` — different driver model)
- **MUST** pass the locator file name (without `.locators.json`) to `super()` constructor
- Methods use `BaseScreen` inherited methods: `tap()`, `typeText()`, `getText()`, `getAttribute()`, `isVisible()`, `waitForElement()`, `swipe()`, `scrollToElement()`, `longPress()`, `takeScreenshot()`, `goBack()`
- **NO raw selectors** — all element access through `this.loc.get('key')` or inherited methods
- `typeText()` automatically hides keyboard after typing
- One screen object per distinct app screen/view

### 16.3 Mobile Spec File Structure

**File location:** `output/tests/mobile/[{folder}/]{scenario}.spec.ts`

Mobile scenarios live FLAT under `scenarios/mobile/[{folder}/]{scenario}.md`. The framework does NOT segregate scenarios by platform (no `scenarios/mobile/android/` / `scenarios/mobile/ios/` directories). The platform dimension is carried by the `Platform:` header in the scenario metadata and by the platform-keyed locator JSON. See §16.3a below for the platform tag the Builder MUST emit.

```typescript
import { browser, expect } from '@wdio/globals';
import { SpeedtestHomeScreen } from '../../../screens/SpeedtestHomeScreen';
import { SpeedtestResultsScreen } from '../../../screens/SpeedtestResultsScreen';
import testData from '../../../test-data/mobile/speedtest-run-test.json';

describe('Speedtest — Run Speed Test @smoke @P0 @android-only', () => {
  let homeScreen: SpeedtestHomeScreen;
  let resultsScreen: SpeedtestResultsScreen;

  before(async () => {
    homeScreen = new SpeedtestHomeScreen(browser);
    resultsScreen = new SpeedtestResultsScreen(browser);
  });

  it('should run a speed test and verify results @smoke @P0', async () => {
    // Step 1 — Wait for home screen
    console.log(`[${new Date().toISOString()}] Step 1 — Wait for home screen`);
    await homeScreen.waitForScreen();

    // Step 2 — VERIFY: GO button visible
    console.log(`[${new Date().toISOString()}] Step 2 — VERIFY: GO button visible`);
    expect(await homeScreen.isGoButtonVisible()).toBe(true);

    // Step 3 — Tap GO
    console.log(`[${new Date().toISOString()}] Step 3 — Tap GO`);
    await homeScreen.tapGoButton();

    // Step 4 — Wait for results
    console.log(`[${new Date().toISOString()}] Step 4 — Wait for results`);
    await resultsScreen.waitForResults(testData.timeouts.testCompletionMs);

    // Step 5 — VERIFY: Download speed > 0
    console.log(`[${new Date().toISOString()}] Step 5 — VERIFY: Download speed > 0`);
    const downloadSpeed = await resultsScreen.getDownloadSpeed();
    expect(parseFloat(downloadSpeed)).toBeGreaterThan(0);

    // Step 6 — SCREENSHOT
    console.log(`[${new Date().toISOString()}] Step 6 — SCREENSHOT`);
    await resultsScreen.takeScreenshot('speedtest-results');
  });
});
```

**Rules — HARD STOP on each:**
1. **Import from `@wdio/globals`** — NOT from `@playwright/test`. Use `import { browser, expect } from '@wdio/globals'`
2. **Mocha `describe`/`it`** — NOT Playwright `test.describe`/`test()`. WDIO uses Mocha BDD
3. **Mocha hooks** — `before`/`after`/`beforeEach`/`afterEach` — NOT `test.beforeAll`/`test.afterAll`
4. **No `test.step()`** — Use comment markers: `// Step N — description`
5. **No `expect.soft()`** — For VERIFY_SOFT, use try/catch pattern
6. **No `test.info().attach()`** — For SCREENSHOT, use `await screen.takeScreenshot('name')`
7. **Tags in title strings** — `it('test name @smoke @P0', ...)` NOT `{ tag: ['@smoke'] }`
8. **Platform tag MANDATORY** — every top-level `describe` title MUST include exactly one of `@android-only`, `@ios-only`, or `@cross-platform` (see §16.3a below)
9. **Screen instantiation** — `new ScreenName(browser)` in `before()` hook, NOT in each test
10. **CAPTURE variables** — `let` in outer `describe` scope, assigned inside `it()`
11. **EVERY `// Step N —` comment marker MUST be followed by a `console.log` as the next line** — format: `` console.log(`[${new Date().toISOString()}] Step N — {description}`) ``. This provides real-time terminal visibility during mobile test execution and CI/CD pipeline logs. Consistent with the web/api/hybrid `test.step()` logging rule.

### 16.3a Platform Tag — MANDATORY in every mobile spec title

The Builder MUST read the `Platform:` header from the enriched scenario `.md` and emit the corresponding platform tag in the top-level `describe` title string. This is non-negotiable — every mobile spec must declare its platform scope at the tag level so the runtime filter (`--mochaOpts.grep`) can select the right specs for the current `PLATFORM` env var.

**Mapping from scenario `Platform:` header → spec tag:**

| Scenario header | Spec `describe` tag | Semantics |
|---|---|---|
| `Platform: android` | `@android-only` | Only runs when `PLATFORM=android` |
| `Platform: ios` | `@ios-only` | Only runs when `PLATFORM=ios` |
| `Platform: both` | `@cross-platform` | Runs under both `PLATFORM=android` and `PLATFORM=ios` — REQUIRES every locator JSON entry for this scenario to have both `android:` and `ios:` sub-objects |

**Correct examples:**

```typescript
// From a scenario with "Platform: android"
describe('Android Quick Settings toggle @smoke @P2 @android-only', () => { ... });

// From a scenario with "Platform: ios"
describe('iOS Share Sheet extension @regression @P1 @ios-only', () => { ... });

// From a scenario with "Platform: both" + locators with android:/ios: sub-objects
describe('Flipkart — Add to Cart Through Checkout @regression @P1 @cross-platform', () => { ... });
```

**Wrong examples:**

```typescript
// WRONG — no platform tag
describe('Flipkart — Add to Cart @regression @P1', () => { ... });

// WRONG — two platform tags (must be exactly one)
describe('Cart flow @smoke @android-only @cross-platform', () => { ... });

// WRONG — bare @android tag (could partial-match other filters, e.g., @android-hybrid)
describe('Login flow @smoke @android', () => { ... });
```

**Validation — fail-fast at generation time:** if the Builder is told to emit a `@cross-platform` spec but the scenario's locator JSON file(s) are missing `ios:` entries for any element, the Builder MUST refuse and emit an error:

```
ERROR: Scenario declares Platform: both but locators/mobile/flipkart-home-screen.locators.json
is missing ios: sub-object for elements: [searchButton, cartIcon]. Either:
  1. Add ios: strategies to those elements, OR
  2. Change the scenario Platform: header to 'android' (producing @android-only tag)
```

This catches "I said both but I only captured Android" drift at spec generation, not at runtime.

**Executor rule:** when running mobile specs, always pass the platform filter:

```bash
PLATFORM=android npx wdio run wdio.conf.ts --mochaOpts.grep "@android-only|@cross-platform"
PLATFORM=ios     npx wdio run wdio.conf.ts --mochaOpts.grep "@ios-only|@cross-platform"
```

Without the filter, `PLATFORM=android` would attempt to execute `@ios-only` specs — they would fail at the locator-lookup stage (no `android:` sub-object) and pollute the test report. The filter is the cheap safety net; the platform tag is the contract.

**Reviewer rule (Dim 3 — Test Architecture):** every mobile spec MUST declare exactly one platform tag in the top-level `describe` title. Zero tags or multiple tags is a Dim 3 failure.

### 16.4 PopupGuard for Apps with Overlays

Most real-world apps show overlays: permission dialogs, promo banners, app rating requests, notification prompts, ad interstitials. `PopupGuard` handles these automatically for **any** app — not limited to specific apps.

```typescript
import { PopupGuard } from '../core/popup-guard';

before(async () => {
  const guard = new PopupGuard(browser);
  // Add app-specific patterns (optional — system dialog patterns are built-in)
  guard.addPattern({ name: 'app-promo-banner', textPattern: 'Shop now|Download', dismissBy: 'back' });
});
```

Call `await guard.dismiss()` before critical interactions. PopupGuard checks for known overlay patterns and dismisses them. System permission dialogs (location, notifications) are handled by default. Add app-specific patterns for app-level overlays.

Simple demo/test apps (e.g., Sauce Labs demo) with no random popups may not need PopupGuard.

### 16.5 Clean State Pattern

Mobile apps maintain state between tests (unlike web which gets a fresh browser context). Use `force-stop + relaunch` for clean state:

```typescript
async function navigateToHome(): Promise<void> {
  await browser.executeScript('mobile: shell', [{
    command: 'am', args: ['force-stop', 'com.example.app']
  }]);
  await browser.pause(2000);
  await browser.executeScript('mobile: shell', [{
    command: 'am', args: ['start', '-n', 'com.example.app/.MainActivity']
  }]);
  await browser.pause(5000);
}
```

### 16.6 Coordinate Tap Fallback

For Compose/SwiftUI elements with NO accessibility nodes (e.g., calendar date cells):

```typescript
// FRAGILE: Compose calendar element, no accessibility node
await browser.action('pointer')
  .move({ duration: 0, origin: 'viewport', x: 540, y: 860 })
  .down({ button: 0 }).pause(100).up({ button: 0 })
  .perform();
```

**MUST** include `// FRAGILE:` comment explaining why selectors are not available.

### 16.7 Mobile-Hybrid Spec Pattern

For `mobile-hybrid` type (native app + API calls):

```typescript
import { browser, expect } from '@wdio/globals';
import axios from 'axios';

describe('Mobile-Hybrid Flow @smoke @P1 @android-only', () => {
  it('should verify API data in mobile app', async () => {
    // API step — wrap in browser.call() for WDIO compatibility
    let resourceId: string;
    await browser.call(async () => {
      const res = await axios.post(`${process.env.API_BASE_URL}/resources`, { name: 'Test' });
      resourceId = res.data.id;
    });

    // Mobile step — screen object interaction
    const homeScreen = new HomeScreen(browser);
    await homeScreen.typeText('searchInput', resourceId!);
    expect(await homeScreen.getText('firstResult')).toContain('Test');
  });
});
```

`browser.call()` wraps async non-WebDriver code within a WDIO test. CAPTURE variables are shared between API and mobile phases via outer-scope `let`.

---

### 16.8 Mobile Anti-Patterns — NEVER Do These

The following patterns are forbidden in mobile locator JSONs and screen-object code. The Builder MUST refactor any candidate locator that matches a Level 1 anti-pattern (see Builder genericization rules) before writing the file.

#### AP-1: Hardcoding test-specific values in locators

WRONG:
```json
{
  "productName": { "android": { "uiautomator": "new UiSelector().textContains(\"LUKZER Electric\")" } }
}
```

RIGHT (generic, structural):
```json
{
  "productName": { "android": { "xpath": "//android.widget.TextView[@text='Total Amount']/..//android.widget.TextView[starts-with(@text,'₹')]" } }
}
```

**Rule:** Before writing a locator, ask: "Would this work for a different product/user/value?" If no, use a structural anchor instead.

#### AP-2: Multi-element text matching

WRONG: `textContains("LUKZER Electric Height Adjustable")` — spans two TextView elements, never resolves.
RIGHT: Two separate locators — one per TextView — or an XPath anchor from a stable label.

#### AP-3: Full-tree XPath in wait loops

WRONG: `driver.$$('//android.widget.ImageView')` — scans the entire a11y tree, 20-30s per call on RN apps.
RIGHT: Targeted locator via `MobileLocatorLoader` or a `UiSelector` with specific attributes.

#### AP-4: Contradictory flow steps

WRONG: `searchFor(query)` (types + Enter → submits the search) followed by `tapSuggestion()` (tries to tap a suggestion that's no longer visible).
RIGHT: Pick one path — either press Enter to submit OR tap a suggestion. Not both.

#### AP-5: Assuming WebView without verification

WRONG: Generating `switchContext('WEBVIEW_...')` code because the screen "might be a WebView".
RIGHT: Default to native. Only emit WebView logic when the Explorer's enriched.md explicitly documents that `appium_context` (or `driver.getContexts()`) returned a `WEBVIEW_*` context for the screen.

#### AP-6: No keyboard dismissal after text input

WRONG: `setValue(text)` followed by `swipe('up')` — keyboard is visible, GBoard glide-typing injects characters into the EditText during the swipe gesture.
RIGHT: Always `hideKeyboard()` after text input if any scrolling follows. `BaseScreen.typeText()` and `BaseScreen.pressSequentially()` already do this — only raw `el.setValue()` calls need it manually.

#### AP-7: Missing performance settings for RN apps

WRONG: `wdio.conf.ts` without `waitForIdleTimeout: 0` — every query takes 20-30s on React Native apps.
RIGHT: UiAutomator2 performance settings applied in the `before()` hook (see `templates/config-mobile/wdio.conf.ts`).

---

### 16.9 Mobile Lifecycle Hooks — Code Pattern

When a mobile scenario file contains any of `## Common Setup Once`, `## Common Setup`, `## Common Teardown`, `## Common Teardown Once`, the Builder MUST emit the corresponding Mocha hook. `USE_HELPER` steps in these sections are emitted as helper function calls inside the hook — see `keyword-reference.md § USE_HELPER in lifecycle hooks` for the full pattern. Mapping:

| Section in `.md` | Mocha hook |
|---|---|
| `## Common Setup Once` | `before()` |
| `## Common Setup` | `beforeEach()` |
| `## Common Teardown` | `afterEach()` |
| `## Common Teardown Once` | `after()` |

```typescript
import { browser, expect } from '@wdio/globals';
import { LoginScreen } from '../../../screens/LoginScreen';
import { HomeScreen } from '../../../screens/HomeScreen';

describe('Login Feature @smoke @android-only', () => {
  let loginScreen: LoginScreen;
  let homeScreen: HomeScreen;

  before(async () => {
    // [Setup Once] — runs once before all `it()` blocks in this file
  });

  beforeEach(async () => {
    // [Before Each] — runs before every `it()`
    loginScreen = new LoginScreen(browser);
    homeScreen = new HomeScreen(browser);
  });

  it('Successful login @smoke @P0', async () => {
    // Step 1 — Tap email input
    await loginScreen.tap('emailInput');
    // ...
  });

  afterEach(async () => {
    // [After Each] — runs after every `it()`
  });

  after(async () => {
    // [Teardown Once] — runs once after all `it()` blocks
  });
});
```

**Fixture rule (mobile):** `browser` is a WDIO global. NEVER destructure it. NEVER write `async ({ browser }) => ...` — that is Playwright syntax and breaks WDIO.

**Step numbering rule:** Lifecycle hook bodies use semantic prefixes (`[Setup Once]`, `[Before Each]`, `[After Each]`, `[Teardown Once]`) — NOT numbered Step N markers. Only the body of `it()` blocks uses numbered `// Step N — ...` comments.

---

### 16.10 Mobile VERIFY_SOFT — Code Pattern

WDIO's `expect-webdriverio` does NOT have `expect.soft()`. Mobile soft assertions use a `softAssertions: string[]` array at the describe scope, `BaseScreen.recordSoftFailure()` for screenshot + message capture, and a final conditional throw.

```typescript
import { browser, expect } from '@wdio/globals';
import { CartScreen } from '../../../screens/CartScreen';

describe('Cart verification @regression @android-only', () => {
  let cartScreen: CartScreen;
  let softAssertions: string[];

  beforeEach(async () => {
    cartScreen = new CartScreen(browser);
    softAssertions = []; // MUST reset per test
  });

  it('Cart shows correct totals @regression', async () => {
    // ... preceding steps ...

    // Step N — VERIFY_SOFT: Cart badge shows "2"
    try {
      expect(await cartScreen.getCount('cartBadge')).toBe(2);
    } catch (err) {
      softAssertions.push(await cartScreen.recordSoftFailure('cart-badge', err));
    }

    // Step N+1 — VERIFY_SOFT: Subtotal is "$29.98"
    try {
      expect(await cartScreen.getText('subtotal')).toBe('$29.98');
    } catch (err) {
      softAssertions.push(await cartScreen.recordSoftFailure('subtotal', err));
    }

    // MUST be the last statement of the it() block
    if (softAssertions.length > 0) {
      throw new Error(
        `${softAssertions.length} soft assertion(s) failed:\n` + softAssertions.join('\n'),
      );
    }
  });
});
```

**MANDATORY rules:**
- `softAssertions: string[]` declared at describe scope; reset in `beforeEach`
- Each VERIFY_SOFT step uses `try { expect(...) } catch (err) { softAssertions.push(await screen.recordSoftFailure(label, err)); }`
- The label MUST be a short kebab-case identifier (used in the screenshot filename)
- The conditional throw is the LAST statement of every test that contains any VERIFY_SOFT
- Do NOT convert VERIFY to VERIFY_SOFT or vice versa to make tests pass

---

### 16.11 Mobile DATASETS — Code Pattern

```typescript
import { browser, expect } from '@wdio/globals';
import { LoginScreen } from '../../../screens/LoginScreen';
import { HomeScreen } from '../../../screens/HomeScreen';
import testData from '../../../test-data/mobile/login-datasets.json';

describe('Login — data-driven @regression @android-only', () => {
  for (const data of testData) {
    it(`Login: ${data.username || '(empty)'} — expects ${data.expectedResult} @regression`, async () => {
      const loginScreen = new LoginScreen(browser);
      // Step 1 — Type username
      await loginScreen.typeText('emailInput', data.username);
      // Step 2 — Type password
      await loginScreen.typeText('passwordInput', data.password);
      // Step 3 — Tap sign in
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

**MANDATORY rules:**
- The `for...of` loop MUST be inside `describe()` and OUTSIDE `it()` so Mocha discovers each iteration as a separate test at file load time
- The test data JSON file lives at `output/test-data/mobile/{scenario}-datasets.json`
- Each row's identifying field MUST appear in the `it()` title for clear reporting
- Tags appear in the title string (`@regression` etc.) — Mocha has no `tag` parameter
