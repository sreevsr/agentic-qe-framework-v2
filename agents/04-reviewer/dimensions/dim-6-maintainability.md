# Dimension 6: Maintainability (Weight: Medium)

**Applies to:** ALL types.

## Files to Examine
- Page objects, helper files, locator JSONs from manifest

## Checklist — MUST score each item

- [ ] Adding a new page requires only: new locator JSON + new page object + new spec
- [ ] Changing a selector requires editing only the locator JSON file
- [ ] Test data changes require no code changes
- [ ] Framework core (locator-loader, base-page, test-data-loader) is generic and reusable
- [ ] Shared reference data (users, products) lives in `test-data/shared/`, not duplicated per scenario
- [ ] If team-maintained `*.helpers.ts` files exist: they follow the convention (`{PageName}WithHelpers extends {PageName}`, JSDoc with `@scenario-triggers`, `@helpers` tag on class)
- [ ] Custom helper logic is in `*.helpers.ts` files, not mixed into Explorer-Builder-generated page objects

## Scoring
- **5/5** — Clean separation, single point of change for selectors/data, proper helper pattern
- **4/5** — 1-2 minor coupling issues
- **3/5** — Some selectors duplicated across files, or data partially hardcoded
- **2/5** — Tight coupling between tests and page objects, changes ripple across files
- **1/5** — Monolithic spec with no separation of concerns

**Score: _/5**
