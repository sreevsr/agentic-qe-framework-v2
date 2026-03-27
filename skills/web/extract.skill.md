# Skill: web/extract

## Input
- **selector** (string, required): Element name via LocatorLoader
- **property** ('text' | 'innerText' | 'textContent' | 'value' | 'attribute' | 'count' | 'isVisible' | 'isEnabled' | 'isChecked', required)
- **attributeName** (string, optional): When property is 'attribute'

## Output
- **value** (string | number | boolean)

## Rules — MUST Follow
- **MUST** use LocatorLoader for element access — NEVER raw selectors
- **MUST** store extracted values in `let` variables in the outer test scope (for CAPTURE)
- **MUST** create getter methods in page objects that return the extracted value
- **MUST NOT** modify or transform extracted values before assertion — assert the raw value

## Code Patterns
```typescript
// CAPTURE: Read subtotal as {{subtotal}}
const subtotal = await page.locator(loc.get('subtotalLabel')).textContent();

// Get item count
const itemCount = await page.locator(loc.get('cartItems')).count();

// Check visibility
const isVisible = await page.locator(loc.get('errorMessage')).isVisible();

// Get input value
const inputValue = await page.locator(loc.get('emailInput')).inputValue();

// Get attribute
const href = await page.locator(loc.get('downloadLink')).getAttribute('href');
```
