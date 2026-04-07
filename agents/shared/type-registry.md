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
| **Scenario input** | `scenarios/mobile/{scenario}.md` or `scenarios/mobile/{folder}/{scenario}.md` |
| **Requires browser exploration?** | Yes — Explorer/Builder uses Appium MCP for native app interaction |
| **Explorer/Builder source** | Scenario `.md` file |
| **Explorer/Builder inputs** | Scenario `.md` + app-context (if exists) |
| **Test fixture** | WDIO driver (not Playwright fixtures) |
| **Test spec path** | `output/tests/mobile/[{folder}/]{scenario}.spec.ts` |
| **Test data path** | `output/test-data/mobile/{scenario}.json` |
| **Creates locator JSONs?** | Yes — `output/locators/mobile/{screen-name}.locators.json` |
| **Creates page objects?** | Yes — `output/screens/{ScreenName}Screen.ts` (Screen Objects, not Page Objects) |
| **Helper files apply?** | Yes — `output/screens/{ScreenName}Screen.helpers.ts` |
| **Explorer report used?** | No |
| **Selector externalization** | Required — accessibility_id > id > class chain/predicate > xpath |
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

| Decision | web | api | hybrid |
|----------|-----|-----|--------|
| Open browser? | **YES** — full MCP exploration | **NO** — API only, no browser | **YES** — for UI steps |
| Create locator JSONs? | Yes — one per page | No | Yes — one per UI page |
| Create page objects? | Yes — one per page | No | Yes — one per UI page |
| Discover helper files? | Yes — scan `output/pages/*.helpers.ts` | No | Yes |
| Test fixture in spec | `{ page }` | `{ request }` | **`{ page, request }`** — ALWAYS both |
| beforeAll/afterAll fixture | `{ browser }` (create page manually) | `{ browser }` (use `playwrightRequest.newContext()` for API) | `{ browser }` (create page or request context manually) |
| beforeEach/afterEach fixture | `{ page }` | `{ request }` | `{ page, request }` |
| Keyword: SCREENSHOT | `page.screenshot()` + `test.info().attach()` | N/A | `page.screenshot()` + `test.info().attach()` |
| Keyword: API steps | Optional (ad-hoc mixed) | Primary pattern | **Primary** — interleaved with UI steps |
| App-context read/write | Yes | Yes (API patterns) | Yes |

### Executor

| Decision | web | api | hybrid |
|----------|-----|-----|--------|
| Source file for diagnosis | Explorer report + error-context.md | Explorer report + parsed results | Explorer report + error-context.md |
| Selector issues | Escalate — Explorer/Builder already verified selectors | N/A | Escalate (UI steps) |
| API errors | N/A (unless mixed) | Diagnose per-host, check auth, check payload | Diagnose per-host (API steps) |
| Hybrid state mismatch | N/A | N/A | Flag when UI state contradicts API response |
| CRUD persistence guardrail | N/A | Flag as POTENTIAL BUG (unless `API Behavior: mock`) | Flag as POTENTIAL BUG (unless `API Behavior: mock`) |
| Max cycles | 3 | 3 | 3 |
| Helper file pre-check gate | Yes — NEVER edit `*.helpers.ts` | N/A | Yes — NEVER edit `*.helpers.ts` |

### Reviewer

| Decision | web | api | hybrid |
|----------|-----|-----|--------|
| Dimension 1: Locator Quality | Audit primary + 2 fallbacks, no raw selectors | N/A (skip) | Audit UI element selectors only |
| Dimension 6: Helper file conventions | Verify helpers follow naming convention, specs import helpers class | N/A | Verify helpers for UI pages |
| Dimension 6: API fixture check | N/A | Verify `request` fixture used (not fetch/axios) | Verify `{ page, request }` destructured |
| Dimension 8: API Test Quality | N/A | Audit CRUD coverage, error handling, auth patterns | Audit API steps within hybrid spec |

---

## Shared Features (All Types)

These features work identically regardless of type:

- **Tags** → `{ tag: ['@smoke', '@P0'] }` on every test; hybrid tests must also include `@hybrid` tag
- **VERIFY** → `expect()` assertions
- **CAPTURE** → Variable assignment via getter
- **CALCULATE** → Arithmetic on captured values
- **SAVE** → `saveState()` for cross-scenario persistence
- **DATASETS** → Parameterized `for...of` loops
- **SHARED_DATA** → `loadTestData()` from `core/test-data-loader`
- **ENV_VARS** → `{{ENV.VARIABLE}}` → `process.env.VARIABLE`
- **Multi-scenario** → `test.describe()` + `test.beforeAll()` + `test.beforeEach()` + `test.afterEach()` + `test.afterAll()` (each hook generated only if the corresponding section exists in the scenario file)
- **beforeAll/afterAll fixture** → `{ browser }` only — no `page` or `request`; create manually if needed
- **beforeEach/afterEach fixture** → per type: `{ page }` (web), `{ request }` (api), `{ page, request }` (hybrid)
- **Test data** → `output/test-data/{type}/{scenario}.json`
- **Shared test data** → `output/test-data/shared/` (immutable)
- **Executor max cycles** → 3 (all types)
- **Reviewer** → 9 quality dimensions, score 1-5 each
- **Pipeline summary** → Standardized report format

---

## Adding a New Type

To add a new type (e.g., `mobile`):

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
