# Skill: a11y/aria-check

## Input
- **selector** (string, required): Element to check
- **checks** (array, required): What to verify — 'role', 'label', 'describedby', 'state', 'keyboard-nav'

## Output
- **passed** (boolean), **issues** (string[])

## Rules — MUST Follow
- **MUST** verify interactive elements have accessible names (aria-label, aria-labelledby, or visible text)
- **MUST** verify form inputs have associated labels
- **MUST** verify ARIA roles match element behavior (e.g., button role on clickable divs)
- **MUST** verify keyboard navigation works for all interactive elements (Tab, Enter, Space, Escape)

## Code Patterns
```typescript
// Check element has accessible name
const button = page.locator(loc.get('submitButton'));
await expect(button).toHaveAttribute('aria-label', /.+/);
// OR
const name = await button.evaluate(el => el.getAttribute('aria-label') || el.textContent);
expect(name).toBeTruthy();

// Check form input has label
const input = page.locator(loc.get('emailInput'));
const labelledBy = await input.getAttribute('aria-labelledby');
const label = await input.getAttribute('aria-label');
const id = await input.getAttribute('id');
const hasLabel = labelledBy || label || (id && await page.locator(`label[for="${id}"]`).count() > 0);
expect(hasLabel).toBeTruthy();

// Check ARIA role
await expect(page.locator(loc.get('dropdown'))).toHaveAttribute('role', 'listbox');

// Keyboard navigation test
await page.keyboard.press('Tab');
const focused = await page.evaluate(() => document.activeElement?.getAttribute('data-testid'));
expect(focused).toBe('first-interactive-element');
```

## Known Patterns
- **Custom components:** React/Angular custom dropdowns often missing ARIA roles
- **Dynamic content:** ARIA live regions needed for content that updates without page reload
- **Enterprise tables:** Complex data grids need proper row/cell/header ARIA roles
