# Dimension 6: Maintainability (Weight: Medium)

**Applies to:** ALL types.

## Files to Examine
- Page objects, helper files, locator JSONs from manifest

## Checklist — MUST score each item

- [ ] Adding a new page requires only: new locator JSON + new page object + new spec
- [ ] Changing a selector requires editing only the locator JSON file
- [ ] Test data changes require no code changes
- [ ] Framework core (locator-loader, base-page, test-data-loader) is generic and reusable
- [ ] Shared reference data (users, products) lives in `test-data/shared/`, not duplicated per scenario
- [ ] If team-maintained `*.helpers.ts` files exist: they follow the convention (`{PageName}WithHelpers extends {PageName}`, JSDoc with `@scenario-triggers`, `@helpers` tag on class)
- [ ] Custom helper logic is in `*.helpers.ts` files, not mixed into Explorer/Builder-generated page objects
- [ ] **No scenario-specific string literals in page-object methods.** A string literal used inside a page-object method's `getByRole({ name: 'X' })`, `getByText('X')`, `.filter({ hasText: 'X' })`, or `.includes('X')` call is ALLOWED only when `'X'` appears in the SAME page's locator JSON (as part of a captured primary/fallback selector). If `'X'` is scenario-specific data (a product name, a user name, an expected value unique to one scenario), it MUST be a method parameter sourced from test-data — NOT a literal baked into the page object.

  **Rationale:** hardcoded scenario data in a page object couples the page object to one scenario's test data. A second scenario reusing the same page object with different data silently misbehaves.

  **Allowed (page's own identity, reinforced by locator JSON):**
  ```ts
  // "Log In" captured in login-page.locators.json's loginButton
  await this.page.getByRole('button', { name: 'Log In' }).click();
  ```

  **Not allowed (scenario-specific data):**
  ```ts
  // Product name is test-data for ONE scenario — must be a parameter
  await this.page.getByRole('checkbox', { name: 'Premium Widget Pack 3.0' });
  ```

  **Fix pattern:** accept the string as a parameter (`async selectProduct(productName: string)`) and source from `testData.expectedProduct` in the spec.

  **Grep signal:** string literals in `output/pages/*.ts` that do NOT appear in the page's matching `output/locators/*-page.locators.json`. Framework constants (timeout values, framework error messages, debug log prefixes) are exempt.

## Scoring
- **5/5** — Clean separation, single point of change for selectors/data, proper helper pattern
- **4/5** — 1-2 minor coupling issues
- **3/5** — Some selectors duplicated across files, or data partially hardcoded
- **2/5** — Tight coupling between tests and page objects, changes ripple across files
- **1/5** — Monolithic spec with no separation of concerns

**Score: _/5**
