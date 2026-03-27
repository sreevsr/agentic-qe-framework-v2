# Skill: web/verify

## Input
- **assertion** ('text' | 'visible' | 'hidden' | 'count' | 'attribute' | 'url' | 'title' | 'value' | 'enabled' | 'disabled' | 'checked' | 'class' | 'css', required)
- **selector** (string, optional): Not needed for url/title assertions
- **expected** (any, required): Expected value
- **soft** (boolean, default: false): If true, use `expect.soft()` instead of `expect()`

## Output
- **passed** (boolean), **actual** (any)

## Rules — MUST Follow
- **MUST** use `expect()` for VERIFY (hard assertion — test stops on failure)
- **MUST** use `expect.soft()` in block scope `{ }` for VERIFY_SOFT (test continues on failure)
- **MUST** attach screenshot on VERIFY_SOFT failure — with descriptive name
- **MUST NOT** convert VERIFY to VERIFY_SOFT or vice versa — EVER
- **MUST NOT** change expected values to make assertions pass — if element found but wrong value, this is a POTENTIAL BUG → use `test.fixme('POTENTIAL BUG: ...')`

## Code Patterns

### VERIFY (Hard Assertion)
```typescript
expect(await page.locator(loc.get('cartBadge')).textContent()).toBe('2');
await expect(page).toHaveURL(/\/dashboard/);
await expect(page.locator(loc.get('heading'))).toBeVisible();
await expect(page.locator(loc.get('items'))).toHaveCount(5);
await expect(page.locator(loc.get('input'))).toHaveAttribute('required', '');
await expect(page.locator(loc.get('button'))).toBeEnabled();
```

### VERIFY_SOFT (Soft Assertion)
```typescript
{
  const result = await page.locator(loc.get('cartBadge')).textContent();
  expect.soft(result).toBe('2');
  if (result !== '2') {
    const screenshot = await page.screenshot({ fullPage: true });
    await test.info().attach('VERIFY_SOFT-failed-cart-badge', {
      body: screenshot, contentType: 'image/png'
    });
  }
}
```

## CRITICAL GUARDRAIL
**NEVER modify expected values in assertions.** If the element is found but shows the wrong value → `test.fixme('POTENTIAL BUG: expected "X" but found "Y"')`. This is an application defect, NOT a test issue.
