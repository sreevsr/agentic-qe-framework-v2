# Skill: mobile/verify

## Input
- **assertion** ('displayed' | 'text' | 'enabled' | 'selected' | 'exists' | 'attribute', required)
- **selector** (string, required): Element locator
- **expected** (any, required): Expected value

## Output
- **passed** (boolean), **actual** (any)

## Rules — MUST Follow
- **MUST** use `waitForDisplayed()` before asserting — mobile elements may not be immediately visible
- **MUST NOT** change expected values — wrong value = POTENTIAL BUG
- **MUST** take screenshot on assertion failure for debugging

## Code Patterns
```typescript
// Verify element is displayed
const element = await $('~welcomeMessage');
await element.waitForDisplayed({ timeout: 10000 });
expect(await element.isDisplayed()).toBe(true);

// Verify text content
expect(await $('~headerTitle').getText()).toBe('Dashboard');

// Verify element enabled
expect(await $('~submitButton').isEnabled()).toBe(true);

// Verify attribute
expect(await $('~checkbox').getAttribute('checked')).toBe('true');
```
