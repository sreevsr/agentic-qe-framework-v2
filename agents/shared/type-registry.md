# Type Registry

**MANDATORY: This is the single source of truth for ALL scenario type definitions.** Every agent MUST consult this file to determine type-specific behavior. DO NOT guess fixture types, file paths, or pipeline stages — look them up here.

**Supported types:** `web`, `api`, `hybrid`, `mobile`, `mobile-hybrid`

**Skills per type:** See `skills/registry.md` → "Skill Set by Test Type" for which skills are active per type.

---

## Type Definitions

### web

| Property | Value |
|----------|-------|
| **Description** | Browser-based UI test scenarios |
| **Scenario input** | `scenarios/web/{scenario}.md` or `scenarios/web/{folder}/{scenario}.md` |
| **Requires browser exploration?** | Yes — Explorer/Builder explores scenario in a live browser via Playwright MCP |
| **Explorer/Builder source** | Scenario `.md` file |
| **Explorer/Builder inputs** | Scenario `.md` + app-context (if exists) + Explorer report (if exists) |
| **Test fixture** | `{ page }` |
| **Test spec path** | `output/tests/web/[{folder}/]{scenario}.spec.ts` |
| **Test data path** | `output/test-data/web/{scenario}.json` |
| **Creates locator JSONs?** | Yes — `output/locators/{page-name}.locators.json` |
| **Creates page objects?** | Yes — `output/pages/{PageName}Page.ts` |
| **Helper files apply?** | Yes — `output/pages/{PageName}Page.helpers.ts` |
| **Explorer report used?** | Yes (if exists) — `output/reports/[{folder}/]explorer-report-{scenario}.md` |
| **Selector externalization** | Required — all selectors in JSON, never in code |
| **Executor source file** | Explorer report |
| **Executor debugging context** | Explorer report + DOM fallback chain |
| **Reviewer: Dimension 4** | Locator Quality — audits primary + 2 fallbacks, no raw selectors |
| **API Behavior escape hatch** | N/A |
| **Pipeline** | [Enrichment Agent] → Explorer/Builder → Executor → Reviewer |

### api

| Property | Value |
|----------|-------|
| **Description** | REST API test scenarios using Playwright request fixture |
| **Scenario input** | `scenarios/api/{scenario}.md` or `scenarios/api/{folder}/{scenario}.md` |
| **Requires browser exploration?** | No — API scenarios use `request` fixture only, no browser needed |
| **Explorer/Builder source** | Scenario `.md` file (no browser, writes code directly from scenario) |
| **Explorer/Builder inputs** | Scenario `.md` + app-context (API patterns, if exists) |
| **Test fixture** | `{ request }` |
| **Test spec path** | `output/tests/api/[{folder}/]{scenario}.spec.ts` |
| **Test data path** | `output/test-data/api/{scenario}.json` |
| **Creates locator JSONs?** | No |
| **Creates page objects?** | No |
| **Helper files apply?** | No |
| **Explorer report used?** | No |
| **Selector externalization** | N/A |
| **Executor source file** | Explorer report + parsed results |
| **Executor debugging context** | Parsed results (status codes, response bodies) + scenario `.md` |
| **Reviewer: Dimension 4** | N/A — Locator Quality is web-only |
| **API Behavior escape hatch** | Yes — `## API Behavior: mock` or `live` controls CRUD persistence guardrails |
| **Pipeline** | Explorer/Builder → Executor → Reviewer (no browser exploration) |

### hybrid

| Property | Value |
|----------|-------|
| **Description** | Combined browser UI + REST API test scenarios in a single test |
| **Scenario input** | `scenarios/hybrid/{scenario}.md` or `scenarios/hybrid/{folder}/{scenario}.md` |
| **Requires browser exploration?** | Yes — Explorer/Builder explores UI steps in browser, API steps via request fixture |
| **Explorer/Builder source** | Scenario `.md` file |
| **Explorer/Builder inputs** | Scenario `.md` + app-context (if exists) + Explorer report (if exists) |
| **Test fixture** | `{ page, request }` — both fixtures always required |
| **Test spec path** | `output/tests/hybrid/[{folder}/]{scenario}.spec.ts` |
| **Test data path** | `output/test-data/hybrid/{scenario}.json` |
| **Creates locator JSONs?** | Yes — one per UI page (API-only steps have no locators) |
| **Creates page objects?** | Yes — one per UI page (API-only steps use `request` directly) |
| **Helper files apply?** | Yes — `output/pages/{PageName}Page.helpers.ts` (UI pages only) |
| **Explorer report used?** | Yes (if exists) — for UI element selectors only |
| **Selector externalization** | Required for UI elements; N/A for API assertions |
| **Executor source file** | Explorer report |
| **Executor debugging context** | Explorer report + DOM fallback chain (UI steps); API diagnostics (API steps) |
| **Reviewer: Dimension 4** | Locator Quality — audits UI selectors only; API assertions excluded |
| **API Behavior escape hatch** | Yes — `## API Behavior: mock` or `live` controls CRUD persistence for API steps |
| **Pipeline** | [Enrichment Agent] → Explorer/Builder → Executor → Reviewer |

### mobile

| Property | Value |
|----------|-------|
| **Description** | Native mobile app test scenarios using Appium MCP |
| **Scenario input** | `scenarios/mobile/{scenario}.md` or `scenarios/mobile/{folder}/{scenario}.md` — **FLAT structure; NO platform subdirectories** (`scenarios/mobile/android/` is forbidden) |
| **Platform targeting** | **MANDATORY** `Platform:` header in scenario metadata, one of: `android`, `ios`, `both`. See `agents/shared/keyword-reference.md § Mobile Platform Header — MANDATORY`. |
| **Requires browser exploration?** | Yes — Explorer/Builder uses Appium MCP for native app interaction |
| **Explorer/Builder source** | Scenario `.md` file |
| **Explorer/Builder inputs** | Scenario `.md` + app-context (if exists) |
| **Test fixture** | WDIO driver (not Playwright fixtures) |
| **Test spec path** | `output/tests/mobile/[{folder}/]{scenario}.spec.ts` — FLAT, no platform subdir |
| **Test data path** | `output/test-data/mobile/{scenario}.json` — FLAT, no platform subdir |
| **Creates locator JSONs?** | Yes — `output/locators/mobile/{screen-name}.locators.json` (platform-keyed format with `android:` and `ios:` sub-objects — the locator file is where the platform dimension lives) |
| **Creates page objects?** | Yes — `output/screens/{ScreenName}Screen.ts` (Screen Objects, not Page Objects). One screen object per screen — shared across platforms. |
| **Helper files apply?** | Yes — `output/screens/{ScreenName}Screen.helpers.ts` |
| **Platform tag in spec title** | **MANDATORY** — the top-level `describe` MUST include exactly one of `@android-only`, `@ios-only`, `@cross-platform`. Enforced by Reviewer Dim 3. |
| **Runtime platform filter** | **MANDATORY** — Executor MUST pass `--mochaOpts.grep "@android-only\|@cross-platform"` (for `PLATFORM=android`) or `--mochaOpts.grep "@ios-only\|@cross-platform"` (for `PLATFORM=ios`) |
| **Explorer report used?** | No |
| **Selector externalization** | Required — Android priority: accessibility_id > id > uiautomator > xpath. iOS priority: accessibility_id > id > class_chain > predicate_string > xpath |
| **Executor source file** | Explorer report |
| **Executor debugging context** | Explorer report + parsed results + page source XML |
| **Reviewer: Dimension 4** | Locator Strategy Quality — audits accessibility_id preference, no index-based xpath |
| **API Behavior escape hatch** | N/A |
| **Pipeline** | [Enrichment Agent] → Explorer/Builder → Executor → Reviewer |

### mobile-hybrid

| Property | Value |
|----------|-------|
| **Description** | Combined native mobile + REST API test scenarios |
| **Scenario input** | `scenarios/mobile/{scenario}.md` with `mobile-hybrid` type |
| **Requires browser exploration?** | Yes — Appium MCP for native steps |
| **Test fixture** | WDIO driver + HTTP request client |
| **Test spec path** | `output/tests/mobile/[{folder}/]{scenario}.spec.ts` |
| **Creates locator JSONs?** | Yes (native steps only) |
| **Creates page objects?** | Yes — Screen Objects (native steps only) |
| **API Behavior escape hatch** | Yes — same as hybrid type |
| **Pipeline** | [Enrichment Agent] → Explorer/Builder → Executor → Reviewer |

---

## Per-Agent Type Lookup

**MANDATORY: Use these tables when ANY agent needs to decide behavior based on type. DO NOT make assumptions — look up the answer here.**

### Explorer/Builder

| Decision | web | api | hybrid | mobile | mobile-hybrid |
|----------|-----|-----|--------|--------|---------------|
| Open browser? | **YES** — Playwright MCP | **NO** — API only | **YES** — for UI steps | **NO** — uses **Appium MCP** for native app | **NO** — Appium MCP for native steps |
| Create locator JSONs? | Yes — one per page | No | Yes — one per UI page | Yes — `output/locators/mobile/{screen}.locators.json` (platform-keyed format) | Yes — native steps only |
| Create page objects? | Yes — one per page | No | Yes — one per UI page | Yes — **Screen Objects** in `output/screens/` (NOT Page Objects) | Yes — Screen Objects, native steps only |
| Discover helper files? | Yes — scan `output/pages/*.helpers.ts` | No | Yes | Yes — scan `output/screens/*.helpers.ts` | Yes |
| Test fixture in spec | `{ page }` | `{ request }` | **`{ page, request }`** — ALWAYS both | WDIO `browser` (from `@wdio/globals`) | WDIO `browser` + HTTP client (axios) |
| Test runner | Playwright | Playwright | Playwright | **WDIO + Mocha** (NOT Playwright) | **WDIO + Mocha** |
| beforeAll/afterAll fixture | `{ browser }` (create page manually) | `{ browser }` (use `playwrightRequest.newContext()` for API) | `{ browser }` (create page or request context manually) | `before`/`after` with `browser` (Mocha hooks) | `before`/`after` with `browser` |
| beforeEach/afterEach fixture | `{ page }` | `{ request }` | `{ page, request }` | `beforeEach`/`afterEach` with `browser` | `beforeEach`/`afterEach` with `browser` |
| Keyword: SCREENSHOT | `page.screenshot()` + `test.info().attach()` | N/A | `page.screenshot()` + `test.info().attach()` | `await screen.takeScreenshot('name')` | `await screen.takeScreenshot('name')` |
| Keyword: API steps | Optional (ad-hoc mixed) | Primary pattern | **Primary** — interleaved with UI steps | N/A | **Primary** — interleaved with native steps (use `browser.call()` + axios) |
| App-context read/write | Yes | Yes (API patterns) | Yes | Yes | Yes |
| Exploration tool | Playwright MCP | N/A | Playwright MCP | **Appium MCP** (`appium/appium-mcp` v1.53.0) | **Appium MCP** (native steps) |
| Screen Object base class | N/A (uses BasePage) | N/A | N/A (uses BasePage) | `BaseScreen` (`output/core/base-screen.ts`) | `BaseScreen` |
| Locator loader | `LocatorLoader` | N/A | `LocatorLoader` | `MobileLocatorLoader` (`output/core/mobile-locator-loader.ts`) | `MobileLocatorLoader` |
| Popup handling | Cookie consent patterns | N/A | Cookie consent patterns | `PopupGuard` (`output/core/popup-guard.ts`) — handles permission dialogs, promo overlays, app rating, etc. | `PopupGuard` |
| Clean state pattern | New browser context per test | N/A | New browser context per test | `force-stop + relaunch` via `mobile: terminateApp` / `activateApp` | `force-stop + relaunch` |

### Executor

| Decision | web | api | hybrid | mobile | mobile-hybrid |
|----------|-----|-----|--------|--------|---------------|
| Test command | `npx playwright test` | `npx playwright test` | `npx playwright test` | `npx wdio run wdio.conf.ts --spec tests/mobile/...` | `npx wdio run wdio.conf.ts --spec tests/mobile/...` |
| Source file for diagnosis | Explorer report + error-context.md | Explorer report + parsed results | Explorer report + error-context.md | Explorer report + page source XML | Explorer report + page source XML |
| Selector issues | Escalate — Explorer/Builder already verified selectors | N/A | Escalate (UI steps) | Heal via Appium MCP — `appium_get_page_source` + `generate_locators` | Heal (native steps) |
| API errors | N/A (unless mixed) | Diagnose per-host, check auth, check payload | Diagnose per-host (API steps) | N/A | Diagnose per-host (API steps) |
| Hybrid state mismatch | N/A | N/A | Flag when UI state contradicts API response | N/A | Flag when native state contradicts API response |
| CRUD persistence guardrail | N/A | Flag as POTENTIAL BUG (unless `API Behavior: mock`) | Flag as POTENTIAL BUG (unless `API Behavior: mock`) | N/A | Flag as POTENTIAL BUG (unless `API Behavior: mock`) |
| Max cycles | 3 | 3 | 3 | 3 | 3 |
| Helper file pre-check gate | Yes — NEVER edit `*.helpers.ts` | N/A | Yes — NEVER edit `*.helpers.ts` | Yes — NEVER edit `*.helpers.ts` | Yes — NEVER edit `*.helpers.ts` |
| Overlay/popup fix | Add cookie consent handling | N/A | Add cookie consent handling | Add pattern to `PopupGuard` or add `await guard.dismiss()` before interaction | Add PopupGuard pattern |
| Keyboard fix | N/A | N/A | N/A | Add `await browser.hideKeyboard()` after input | Add keyboard dismissal |

### Reviewer

| Decision | web | api | hybrid | mobile | mobile-hybrid |
|----------|-----|-----|--------|--------|---------------|
| Dimension 1: Locator Quality | Audit primary + 2 fallbacks, no raw selectors | N/A (skip) | Audit UI element selectors only | Audit accessibility_id preference, no index-based xpath, platform-keyed format | Audit native selectors only |
| Dimension 6: Helper file conventions | Verify helpers follow naming convention, specs import helpers class | N/A | Verify helpers for UI pages | Verify screen helpers follow naming (`*.helpers.ts`) | Verify screen helpers |
| Dimension 6: API fixture check | N/A | Verify `request` fixture used (not fetch/axios) | Verify `{ page, request }` destructured | N/A | Verify `browser.call()` + axios used for API steps |
| Dimension 8: API Test Quality | N/A | Audit CRUD coverage, error handling, auth patterns | Audit API steps within hybrid spec | N/A | Audit API steps within mobile-hybrid spec |

---

## Shared Features (All Types)

These features work identically regardless of type:

- **Tags** → web/api/hybrid: `{ tag: ['@smoke', '@P0'] }` on every test. **Mobile**: tags in `describe`/`it` title strings (e.g., `it('test @smoke @P0', ...)`)
- **VERIFY** → `expect()` assertions (web: `@playwright/test`, mobile: `@wdio/globals`)
- **CAPTURE** → Variable assignment via getter (`let` in outer scope)
- **CALCULATE** → Arithmetic on captured values
- **SAVE** → `saveState()` for cross-scenario persistence
- **DATASETS** → Parameterized `for...of` loops
- **SHARED_DATA** → `loadTestData()` from `core/test-data-loader`
- **ENV_VARS** → `{{ENV.VARIABLE}}` → `process.env.VARIABLE`
- **Multi-scenario** → web/api/hybrid: `test.describe()` + `test.beforeAll()` etc. **Mobile**: Mocha `describe()` + `before()` + `beforeEach()` etc.
- **Step markers** → web/api/hybrid: `await test.step('Step N — desc', async () => {...})`. **Mobile**: `// Step N — desc` comment (no `test.step()` in WDIO/Mocha)
- **Test data** → `output/test-data/{type}/{scenario}.json`
- **Shared test data** → `output/test-data/shared/` (immutable)
- **Executor max cycles** → 3 (all types)
- **Reviewer** → 9 quality dimensions, score 1-5 each
- **Pipeline summary** → Standardized report format

### Mobile-Specific Notes

- **No `test.step()`** — WDIO/Mocha does not have `test.step()`. Use comment markers: `// Step N — description`
- **No `expect.soft()`** — WDIO does not have `expect.soft()`. VERIFY_SOFT uses a `try/catch` + `softAssertions: string[]` pattern with `BaseScreen.recordSoftFailure()` (see `keyword-reference.md`). The describe scope holds the array, `beforeEach` resets it, and the `it()` ends with a conditional throw.
- **No `test.info().attach()`** — For SCREENSHOT, use `await screen.takeScreenshot('name')` (saves PNG to `test-results/screenshots/`). Allure attachments come from the `@wdio/allure-reporter` automatically.
- **No `test.info().annotations`** — For REPORT, use `console.log()` (appears in WDIO spec reporter output and Allure log)
- **Lifecycle hooks** — Mocha `before` / `beforeEach` / `afterEach` / `after` map 1:1 to `Common Setup Once` / `Common Setup` / `Common Teardown` / `Common Teardown Once`. Global `browser` is available in every hook (no fixture destructuring).
- **DATASETS** — `for...of` loop over imported JSON test data, MUST be inside `describe()` and outside `it()` so Mocha discovers each iteration as a separate test at file load time.
- **SHARED_DATA** — Imports `loadTestData` from `core/test-data-loader` (relative path traverses three levels up from a mobile spec: `../../../core/test-data-loader`). Plain TypeScript, no Playwright dependency, works unchanged.
- **SAVE / loadState** — `core/shared-state.ts` uses plain `fs.readFileSync`/`writeFileSync`, works unchanged in WDIO specs.
- **USE_HELPER** — Helper files at `output/screens/{ScreenName}.helpers.ts` are team-owned. Builder MUST NOT create or modify them. If a referenced helper is missing, mark the test with `it.skip(...)` and emit a `// WARNING: USE_HELPER ...` comment.
- **Auto evidence on failure** — `wdio.conf.ts` `afterTest` hook captures screenshot, page source, and screen recording when a test fails. Successful test recordings are discarded.
- **Popup handling** — Production mobile apps require `PopupGuard` for random overlays. Web uses cookie consent patterns. Mobile has permission dialogs, promo banners, app rating, notification prompts, ad interstitials.
- **Compose/SwiftUI** — Some UI frameworks render elements as Canvas with no accessibility nodes. Coordinate-based taps are a valid fallback. MUST document with `// FRAGILE: Compose element, no accessibility node` comment.
- **React Native idle timeout** — RN apps must run with `waitForIdleTimeout: 0` (applied in `wdio.conf.ts` `before()` hook). Without this, every element query waits 10s for "app idle" before traversing the a11y tree.

---

## Adding a New Type

To add a new type (e.g., `desktop`):

1. **Add a new section** to this file following the same property table format
2. **Add per-agent rows** to the Per-Agent Type Lookup tables (all 4 agent tables)
3. **Update scenario templates** — add `scenarios/{type}/_template.md` for the new type
4. **Update `keyword-reference.md`** — add any new keywords or modify existing keyword behavior
5. **Update `guardrails.md`** — add any type-specific guardrails or bug signals
6. **Update the Explorer/Builder** (`agents/core/explorer-builder.md` + `agents/core/code-generation-rules.md`) — add source file patterns, fixture rules
7. **Update the Executor** (`agents/core/executor.md`) — add diagnosis categories for the new type
8. **Update the Copilot/Claude agent wrappers** (`.github/agents/` + `agents/claude/`) — add new agent wrapper if needed
9. **Update the Reviewer** (`agents/04-reviewer/dimensions.md`) — clarify which dimensions apply
10. **Update docs** — `README.md` (supported types), `ENTERPRISE-SCALING-GUIDE.md` (Section 6 capabilities table)

**Estimated file changes for a new type:** ~7-10 files
