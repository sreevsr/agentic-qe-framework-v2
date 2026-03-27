# Skill: web/interact

## Input
- **action** ('click' | 'fill' | 'selectOption' | 'check' | 'uncheck' | 'hover' | 'press' | 'pressSequentially' | 'dblclick' | 'rightClick' | 'focus' | 'clear', required)
- **selector** (string, required): Element name from LocatorLoader
- **value** (string, optional): For fill/selectOption/press actions

## Output
- **success** (boolean), **elementFound** (boolean), **method** (string): The actual method used

## Behavior
1. Locate via `this.loc.get('elementName')` — NEVER use raw selectors
2. Perform interaction (Playwright auto-waits for actionability)
3. On failure: try fallbacks → check app-context → try alternative method
4. Observe page response (dropdown opened? navigation? content updated?)

## Rules — MUST Follow
- **MUST** use LocatorLoader for all selectors — NO raw `page.locator('css')` in page objects
- **MUST** check app-context for known component patterns BEFORE trying default approach
- **MUST NOT** use `{ force: true }` — EVER — unless Scout report explicitly flags HIT-AREA MISMATCH
- If `fill()` doesn't trigger expected events → **MUST** try `pressSequentially()` before marking as failed

## Known Patterns
- **fill() vs pressSequentially():** PCF/Kendo inputs need `pressSequentially()` to trigger search/filter events
- **SVG buttons:** Power Apps uses SVG elements for icons — use `svg:last-of-type`, not `img`
- **Custom dropdowns (Kendo/Fluent):** Click to open → wait for list → click option. DO NOT use `selectOption()` on custom dropdowns
- **Two-step interactions:** Some components require hover first, then click

## Code Patterns
```typescript
await this.page.locator(this.loc.get('submitButton')).click();
await this.page.locator(this.loc.get('searchInput')).fill(value);
await this.page.locator(this.loc.get('searchInput')).pressSequentially(value);
await this.page.locator(this.loc.get('countrySelect')).selectOption(value);
await this.page.locator(this.loc.get('menuItem')).hover();
await this.page.locator(this.loc.get('agreeCheckbox')).check();
```
