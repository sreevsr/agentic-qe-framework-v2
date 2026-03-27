# Skill: web/interact

## Input
- **action** ('click' | 'fill' | 'selectOption' | 'check' | 'uncheck' | 'hover' | 'press' | 'pressSequentially' | 'dblclick', required)
- **selector** (string, required): Element name from LocatorLoader
- **value** (string, optional): For fill/selectOption/press

## Output
- **success** (boolean), **elementFound** (boolean), **method** (string)

## Behavior
1. Locate via `this.loc.get('elementName')`
2. Perform interaction (Playwright auto-waits)
3. On failure: try fallbacks → check app-context → try alternative method
4. Observe page response (dropdown opened? navigation? content update?)

## Known Patterns
- **fill() vs pressSequentially():** PCF/Kendo inputs need `pressSequentially()` to trigger events
- **SVG buttons:** Power Apps uses SVG for icons — use `svg:last-of-type`, not `img`
- **Custom dropdowns:** Click to open → wait for list → click option (NOT `selectOption()`)
- **force:true:** NEVER use unless Scout flags HIT-AREA MISMATCH

## Code Patterns
```typescript
await this.page.locator(this.loc.get('submitButton')).click();
await this.page.locator(this.loc.get('searchInput')).fill(value);
await this.page.locator(this.loc.get('searchInput')).pressSequentially(value);
await this.page.locator(this.loc.get('countrySelect')).selectOption(value);
```
