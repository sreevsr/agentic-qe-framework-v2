# Type Registry

Single source of truth for all scenario type definitions. When agents need to determine type-specific behavior, they consult this file.

**Supported types:** `web`, `api`, `hybrid`

---

## Type Definitions

### web

| Property | Value |
|----------|-------|
| **Description** | Browser-based UI test scenarios |
| **Scenario input** | `scenarios/web/{scenario}.md` or `scenarios/web/{folder}/{scenario}.md` |
| **Requires Analyst?** | Yes — Analyst executes scenario in a real browser via Playwright MCP |
| **Analyst source** | Scenario `.md` file |
| **Generator sources** | Analyst report + scenario `.md` + Scout report (if exists) |
| **Test fixture** | `{ page }` |
| **Test spec path** | `output/tests/web/[{folder}/]{scenario}.spec.ts` |
| **Test data path** | `output/test-data/web/{scenario}.json` |
| **Creates locator JSONs?** | Yes — `output/locators/{page-name}.locators.json` |
| **Creates page objects?** | Yes — `output/pages/{PageName}Page.ts` |
| **Helper files apply?** | Yes — `output/pages/{PageName}Page.helpers.ts` |
| **Scout report used?** | Yes (if exists) — `output/scout-reports/[{folder}/]{scenario}-page-inventory-latest.md` |
| **Selector externalization** | Required — all selectors in JSON, never in code |
| **Healer source file** | Analyst report |
| **Healer selector debugging** | Scout report + DOM fallback chain |
| **Reviewer: Dimension 4** | Locator Quality — audits primary + 2 fallbacks, no raw selectors |
| **API Behavior escape hatch** | N/A |
| **Orchestrator pipeline** | Analyst → Generator → Healer → Reviewer → [Healer Review] |

### api

| Property | Value |
|----------|-------|
| **Description** | REST API test scenarios using Playwright request fixture |
| **Scenario input** | `scenarios/api/{scenario}.md` or `scenarios/api/{folder}/{scenario}.md` |
| **Requires Analyst?** | No — scenario `.md` already exists (created by API Analyst or manually) |
| **Analyst source** | N/A |
| **Generator sources** | Scenario `.md` only (no analyst report, no Scout report) |
| **Test fixture** | `{ request }` |
| **Test spec path** | `output/tests/api/[{folder}/]{scenario}.spec.ts` |
| **Test data path** | `output/test-data/api/{scenario}.json` |
| **Creates locator JSONs?** | No |
| **Creates page objects?** | No |
| **Helper files apply?** | No |
| **Scout report used?** | No |
| **Selector externalization** | N/A |
| **Healer source file** | Raw scenario `.md` |
| **Healer selector debugging** | N/A |
| **Reviewer: Dimension 4** | N/A — Locator Quality is web-only |
| **API Behavior escape hatch** | Yes — `## API Behavior: mock` or `live` controls CRUD persistence guardrails |
| **Orchestrator pipeline** | Generator → Healer → Reviewer → [Healer Review] (skips Analyst) |

### hybrid

| Property | Value |
|----------|-------|
| **Description** | Combined browser UI + REST API test scenarios in a single test |
| **Scenario input** | `scenarios/hybrid/{scenario}.md` or `scenarios/hybrid/{folder}/{scenario}.md` |
| **Requires Analyst?** | Yes — Analyst executes UI steps in browser and observes API responses |
| **Analyst source** | Scenario `.md` file |
| **Generator sources** | Analyst report + scenario `.md` + Scout report (if exists) |
| **Test fixture** | `{ page, request }` — both fixtures always required |
| **Test spec path** | `output/tests/hybrid/[{folder}/]{scenario}.spec.ts` |
| **Test data path** | `output/test-data/hybrid/{scenario}.json` |
| **Creates locator JSONs?** | Yes — one per UI page (API-only steps have no locators) |
| **Creates page objects?** | Yes — one per UI page (API-only steps use `request` directly) |
| **Helper files apply?** | Yes — `output/pages/{PageName}Page.helpers.ts` (UI pages only) |
| **Scout report used?** | Yes (if exists) — for UI element selectors only |
| **Selector externalization** | Required for UI elements; N/A for API assertions |
| **Healer source file** | Analyst report |
| **Healer selector debugging** | Scout report + DOM fallback chain (UI steps); API diagnostics (API steps) |
| **Reviewer: Dimension 4** | Locator Quality — audits UI selectors only; API assertions excluded |
| **API Behavior escape hatch** | Yes — `## API Behavior: mock` or `live` controls CRUD persistence for API steps |
| **Orchestrator pipeline** | Analyst → Generator → Healer → Reviewer → [Healer Review] |

---

## Per-Agent Type Lookup

Use this table when an agent needs to decide behavior based on type.

### Orchestrator

| Decision | web | api | hybrid |
|----------|-----|-----|--------|
| Run Analyst (Stage 1)? | Yes | **Skip** — go directly to Generator | Yes |
| Generator source files | Analyst report + scenario + Scout (if exists) | Scenario `.md` only | Analyst report + scenario + Scout (if exists) |
| Pass `skip_analyst`? | false (default) | true | false (default) |

### Generator

| Decision | web | api | hybrid |
|----------|-----|-----|--------|
| Read analyst report? | Yes | No | Yes |
| Read Scout report? | Yes (if exists) | No | Yes (if exists) — UI elements only |
| Create locator JSONs? | Yes — one per page | No | Yes — one per UI page |
| Create page objects? | Yes — one per page | No | Yes — one per UI page |
| Discover helper files? | Yes — scan `output/pages/*.helpers.ts` | No | Yes |
| Test fixture in spec | `{ page }` | `{ request }` | **`{ page, request }`** — always both |
| beforeAll/afterAll fixture | `{ browser }` (create page manually) | `{ browser }` (use `playwrightRequest.newContext()` for API) | `{ browser }` (create page or request context manually) |
| beforeEach/afterEach fixture | `{ page }` | `{ request }` | `{ page, request }` |
| Keyword: SCREENSHOT | `page.screenshot()` + `test.info().attach()` | N/A | `page.screenshot()` + `test.info().attach()` |
| Keyword: API steps | Optional (ad-hoc mixed) | Primary pattern | **Primary** — interleaved with UI steps |

### Healer

| Decision | web | api | hybrid |
|----------|-----|-----|--------|
| Source file for pre-flight | Analyst report | Raw scenario `.md` | Analyst report |
| Category C (Wrong Selector) | Try fallbacks → check Scout report → fix interaction → construct from snapshot | N/A | Try fallbacks → Scout → snapshot (UI steps only) |
| Category G (API Error) | N/A (unless mixed) | Diagnose per-host, check auth, check payload | Diagnose per-host (API steps) |
| Category H (Hybrid State Mismatch) | N/A | N/A | Flag when UI state contradicts API response |
| Category I (Shared State Issue) | Yes — browser state from prior test | N/A | Yes — browser state from prior test |
| Category J (Business Logic Constraint) | Yes — action succeeds but wrong outcome | N/A | Yes — action succeeds but wrong outcome |
| CRUD persistence guardrail | N/A | Flag as POTENTIAL BUG (unless `API Behavior: mock`) | Flag as POTENTIAL BUG (unless `API Behavior: mock`) |
| Visual diagnosis protocol | Mandatory — Playwright MCP snapshot + screenshot | N/A (text-based) | Mandatory — Playwright MCP snapshot + screenshot |
| Same-root-cause detection | 3 consecutive cycles → UNFIXABLE | 3 consecutive cycles → UNFIXABLE | 3 consecutive cycles → UNFIXABLE |
| Helper file pre-check gate | Yes — never edit `*.helpers.ts` | N/A | Yes — never edit `*.helpers.ts` |

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
- **Healer max cycles** → 3 (web healer), 3 (api healer), 5 (detailed instruction default)
- **Reviewer** → 8 quality dimensions, score 1-5 each
- **Pipeline summary** → Standardized report format

---

## Adding a New Type

To add a new type (e.g., `mobile`):

1. **Add a new section** to this file following the same property table format
2. **Add per-agent rows** to the Per-Agent Type Lookup tables (all 4 agent tables)
3. **Update `path-resolution.md`** — add scenario input path patterns for the new type
4. **Update `keyword-reference.md`** — add any new keywords or modify existing keyword behavior
5. **Update `guardrails.md`** — add any type-specific guardrails or bug signals
6. **Update the Orchestrator** (`.github/agents/orchestrator.agent.md`) — add pipeline stage logic, source file resolution, verification paths
7. **Update the Generator** (`.github/agents/generator.agent.md` + `agents/02-generator/generate-spec.md`) — add source file patterns, fixture rules
8. **Update the Healer** (`agents/03-healer/diagnose-failure.md`) — add diagnosis categories for the new type
9. **Update the Reviewer** (`agents/04-reviewer/dimensions.md`) — clarify which dimensions apply
10. **Update docs** — `README.md` (supported types), `ENTERPRISE-SCALING-GUIDE.md` (Section 6 capabilities table)

**Estimated file changes for a new type:** ~7-10 files
