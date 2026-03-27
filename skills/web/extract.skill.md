# Skill: web/extract

## Input
- **selector** (string, required): Element name via LocatorLoader
- **property** ('text' | 'innerText' | 'textContent' | 'value' | 'attribute' | 'count' | 'isVisible' | 'isEnabled', required)
- **attributeName** (string, optional): When property is 'attribute'

## Output
- **value** (string | number | boolean)

## Code Patterns
```typescript
const subtotal = await page.locator(loc.get('subtotalLabel')).textContent();
const itemCount = await page.locator(loc.get('cartItems')).count();
const isVisible = await page.locator(loc.get('errorMessage')).isVisible();
const inputValue = await page.locator(loc.get('emailInput')).inputValue();
const href = await page.locator(loc.get('downloadLink')).getAttribute('href');
```
