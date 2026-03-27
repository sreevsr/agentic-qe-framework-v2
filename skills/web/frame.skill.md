# Skill: web/frame

## Input
- **frameSelector** (string, required): Selector for the iframe element (name, id, src pattern, or CSS)
- **action** ('enter' | 'exit', required): Enter frame context or return to main page

## Output
- **entered** (boolean), **frameUrl** (string)

## Behavior
1. Use `page.frameLocator()` to enter frame context — Playwright auto-handles nesting
2. All locators within the frame MUST use the frame locator chain
3. To exit: simply use `page.locator()` again (back to main frame)

## Rules — MUST Follow
- **MUST** use `page.frameLocator()` — NEVER `page.frame()` (deprecated pattern)
- **MUST** chain locators: `page.frameLocator('#iframe').locator('.button')` — not two separate calls
- **MUST NOT** assume frame is loaded — wait for frame element first
- For nested iframes: chain frameLocator calls: `page.frameLocator('#outer').frameLocator('#inner').locator('.btn')`

## Code Patterns
```typescript
// Enter iframe and interact
const frame = page.frameLocator('iframe[name="payment"]');
await frame.locator('[name="cardnumber"]').fill('4242424242424242');
await frame.locator('[name="exp-date"]').fill('12/28');
await frame.locator('#submit-btn').click();

// Nested iframes
const nested = page.frameLocator('#outer-frame').frameLocator('#inner-frame');
await nested.locator('.content').textContent();

// Wait for iframe to be available first
await page.waitForSelector('iframe[name="payment"]', { state: 'attached' });
const frame = page.frameLocator('iframe[name="payment"]');
```

## Known Patterns
- **Payment gateways (Stripe, Braintree):** Embed in iframes with randomized names — use src pattern or partial name match
- **SSO iframes:** Some enterprise SSO flows embed login in an iframe
- **CRM embedded forms:** Salesforce, Dynamics embed forms in cross-origin iframes
