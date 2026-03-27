# Dimension 3: Test Architecture (Weight: Medium)

**Applies to:** ALL types.

## Files to Examine
- Spec file, page objects, test data files, helper files (if any) from manifest

## Checklist — MUST score each item

- [ ] Page Object Model properly implemented (web/hybrid) or Screen Object Model (mobile)
- [ ] Test files import page/screen objects — no direct Playwright/WDIO API in tests
- [ ] Test data externalized to JSON — no hardcoded values in specs
- [ ] Multi-scenario files use `test.describe()` with `test.beforeEach()` for common setup
- [ ] DATASETS produce parameterized `for...of` loops, not duplicated test code
- [ ] VERIFY steps produce `expect()` assertions inline, not batched at the end
- [ ] Tags formatted correctly: `{ tag: ['@tagName'] }` with `@` prefix
- [ ] If `test-data/shared/` exists: scenario JSONs do not duplicate values already in shared files
- [ ] If `SHARED_DATA` keyword used: spec imports `loadTestData` from `core/test-data-loader` (not direct JSON import)
- [ ] If `*.helpers.ts` exists for a page: spec imports the helpers class (`{PageName}WithHelpers as {PageName}`), not the base class
- [ ] If `USE_HELPER` keyword used: verify the referenced method exists in the helpers file and the spec calls it

## Scoring
- **5/5** — Clean POM, all data externalized, correct imports, correct patterns
- **4/5** — 1-2 minor issues (e.g., one hardcoded value, one missing helper import)
- **3/5** — Some direct API usage in tests, or test data partially hardcoded
- **2/5** — No page objects, or significant hardcoded data
- **1/5** — No architecture pattern at all

**Score: _/5**
