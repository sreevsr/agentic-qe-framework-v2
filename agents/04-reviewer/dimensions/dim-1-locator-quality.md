# Dimension 1: Locator Quality (Weight: High)

**Applies to:** web, hybrid, mobile, mobile-hybrid. **N/A for:** api.

## Files to Examine
- All `output/locators/*.locators.json` from the explorer report manifest
- All `output/pages/*Page.ts` from the manifest
- For mobile: `output/locators/mobile/*.locators.json` and `output/screens/*Screen.ts`

## Checklist — MUST score each item

- [ ] Every element has a primary selector + at least 2 fallbacks in JSON
- [ ] Primary locators prefer `data-testid` or `id` over CSS classes
- [ ] No fragile selectors: no `nth-child`, no deep CSS paths, no auto-generated IDs
- [ ] No hardcoded selectors in page objects or test files — ALL selectors go through `LocatorLoader` / `this.loc.get()`
- [ ] Selector naming is descriptive camelCase (`submitButton`, not `btn1` or `element3`)
- [ ] For mobile: primary selectors prefer `accessibility_id` > `id` > class chain/predicate. No index-based XPath

## Scoring
- **5/5** — Every element has primary + 2 fallbacks, all stable strategies, zero raw selectors
- **4/5** — 1-2 elements missing a fallback, or 1 fragile selector strategy
- **3/5** — Some elements have only primary (no fallbacks), or CSS class-based primaries
- **2/5** — Multiple raw selectors in page objects, or fragile selectors throughout
- **1/5** — No JSON externalization, selectors hardcoded everywhere

**Score: _/5**
