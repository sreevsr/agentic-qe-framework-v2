# Skill: web/verify

## Input
- **assertion** ('text' | 'visible' | 'hidden' | 'count' | 'attribute' | 'url' | 'title' | 'value', required)
- **selector** (string, optional): Not needed for url/title
- **expected** (any, required)
- **soft** (boolean, default: false): Use expect.soft() if true

## Output
- **passed** (boolean), **actual** (any)

## Code Patterns
```typescript
// VERIFY (hard)
expect(await page.locator(loc.get('cartBadge')).textContent()).toBe('2');
await expect(page).toHaveURL(/\/dashboard/);

// VERIFY_SOFT (soft — block scope + screenshot on fail)
{
  const result = await page.locator(loc.get('cartBadge')).textContent();
  expect.soft(result).toBe('2');
  if (result !== '2') {
    const screenshot = await page.screenshot({ fullPage: true });
    await test.info().attach('VERIFY_SOFT-failed-cart-badge', { body: screenshot, contentType: 'image/png' });
  }
}
```

## CRITICAL GUARDRAIL
NEVER modify expected values. Wrong value = POTENTIAL BUG in the app, not a test issue.
