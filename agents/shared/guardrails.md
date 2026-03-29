# Enterprise Guardrails — Ownership Boundaries and Forbidden Actions

These guardrails apply to ALL agents in the pipeline. Each agent section below defines how that agent must respond when encountering a boundary.

---

## 1. Helper Files Are TEAM-OWNED (Read-Only)

Helper files (`output/pages/*.helpers.ts`) are team-maintained companion files that extend generated page objects with custom business logic.

**Convention:**
- File: `{PageName}Page.helpers.ts`
- Class: `{PageName}PageWithHelpers extends {PageName}Page`
- JSDoc: `@helpers {PageName}Page` on class, `@scenario-triggers` on methods

**Per-Agent Rules:**

| Agent | Rule |
|-------|------|
| **Explorer/Builder** | NEVER create, modify, or delete `*.helpers.ts` files. Read them for discovery only. If helpers exist, import the helpers class aliased to the base name: `import { CartPageWithHelpers as CartPage } from '../pages/CartPage.helpers'` |
| **Executor** | NEVER modify `*.helpers.ts` files. If a helper method causes a test failure, mark with `test.fixme('HELPER ISSUE: {PageName}.{methodName} — [description]')` and document in the executor report under "Helper Method Issues". Do NOT rewrite, delete, or work around the helper |
| **Reviewer** | Verify specs import the helpers class (not the base class) when helpers exist. Verify helpers follow naming convention and have proper JSDoc with `@helpers` and `@scenario-triggers` tags |

**PRE-CHECK GATE (Explorer/Builder and Executor):**
Before editing ANY file, check its filename first:
- If the file ends with `.helpers.ts` → **STOP. Do NOT edit it.** Mark with `test.fixme('HELPER ISSUE: ...')` and document in the report. Move on to the next failure.

---

## 2. Shared Test Data Is IMMUTABLE

Shared test data (`output/test-data/shared/`) contains cross-scenario reference data (users, products, customers) that multiple scenarios depend on.

**Per-Agent Rules:**

| Agent | Rule |
|-------|------|
| **Explorer/Builder** | Create shared data files ONLY if the data is genuinely reusable. If a shared file already exists, do NOT overwrite it — another scenario already created it. Shared data files go in `output/test-data/shared/` — flat structure, no nesting |
| **Executor** | NEVER modify files in `test-data/shared/`. If a shared value causes a failure, create a scenario-level override in `test-data/{type}/{scenario}.json` instead |
| **Reviewer** | Verify scenario JSONs do not duplicate values already in shared files |

**PRE-CHECK GATE (Explorer/Builder and Executor):**
- If the file is in `test-data/shared/` → **STOP.** Create a scenario-level override instead.

---

## 3. Application Bugs Are NEVER Masked

The pipeline fixes TEST CODE (how we test). It must NEVER alter EXPECTED BEHAVIOR (what we test).

**Forbidden Actions (all agents):**
- Change expected status codes in assertions (e.g., 201 → 200)
- Change expected values in VERIFY assertions that the scenario explicitly defines
- Remove or comment out VERIFY/assertion steps
- Substitute a different resource ID when a CRUD chain fails at persistence
- Remove response body field assertions
- Change CALCULATE expected results

**When to Flag as POTENTIAL BUG (Explorer/Builder and Executor):**

API signals (applies to `api` and `hybrid` types):
- POST returns 2xx but subsequent GET returns 404 or empty body
- PUT/PATCH returns 2xx but subsequent GET shows unchanged/old values
- DELETE returns 2xx but resource is still accessible via GET

Web signals (applies to `web` and `hybrid` types):
- VERIFY step fails but selector IS correct (element found, wrong content)
- Element visible but disabled/overlapped when scenario expects it clickable
- Navigation lands on unexpected page despite correct URL

Hybrid-specific signals (applies to `hybrid` type only):
- UI state contradicts API response (e.g., page shows "Order confirmed" but API POST returned 500)
- API returns success but UI element does not reflect the change (e.g., API updates cart, UI still shows old count)
- UI action triggers API call that fails silently (e.g., form submits, page shows success, but network response was 4xx/5xx)

Mobile-specific signals (applies to `mobile` and `mobile-hybrid` types):
- App crashes or session lost during a step that should be routine
- Screen does not transition after tap/swipe that should navigate
- WebView content does not match native app state
- Permission dialog blocks interaction but should have been granted

**How to Flag:** Mark with `test.fixme('POTENTIAL BUG: [description]')`, document in the explorer/executor report, do NOT adapt the test.

---

## 4. No Force Bypasses

- NEVER use `{ force: true }` to bypass disabled or overlapped elements — this masks interaction bugs
- **Exception:** Only when a Scout report explicitly flags `HIT-AREA MISMATCH` for the element

---

## 5. No Hardcoded Waits

- NEVER use `page.waitForTimeout()` **UNLESS** it carries a `// PACING: [reason]` comment explaining WHY the delay is needed and WHAT component is slow
- The `// PACING:` comment is a contract — it protects the wait from Reviewer removal. Without the comment, the wait WILL be flagged and removed
- Use proper Playwright waits FIRST: `waitForSelector`, `waitForLoadState`, `waitForURL`, `waitForResponse`, `waitForFunction`
- Only fall back to `waitForTimeout` with PACING comment when proper waits don't work (e.g., component has no observable load indicator)
- Rely on Playwright's auto-waiting where appropriate

---

## 6. No Hardcoded Credentials

- NEVER hardcode passwords, tokens, keys, or secrets in any file
- All credentials must use `process.env.VARIABLE_NAME`
- Scenario files use `{{ENV.VARIABLE}}` pattern
- `.env.example` exists with placeholder values (never real credentials)
- `.env` must be in `.gitignore`

---

## 7. Selector Externalization

- ALL selectors must live in JSON locator files (`output/locators/*.locators.json`)
- Page objects must use `LocatorLoader` (`this.loc.get('elementName')`) — no raw `page.locator()` in page objects or test specs
- Every element needs a primary selector + at least 2 fallbacks
- Selector priority: `data-testid` > `id` > `name` > `role` > CSS class

---

## 8. The API Behavior Escape Hatch

The guardrails in Section 3 are **ABSOLUTE by default**. Only ONE thing overrides them:

**The scenario file declares `## API Behavior: mock` in its header.**

- `mock` → API is non-persistent. Explorer/Builder or Executor MAY adapt tests for non-persistence (use existing IDs, accept mock responses). Document as "Mock API Adaptation" in report.
- `live` or missing → ALL guardrails apply with ZERO exceptions. No rationalization.
- NEVER infer API behavior from URL, API name, or LLM knowledge. Only the explicit `## API Behavior` header controls this.

---

## 9. Scenario Integrity (SACRED — NEVER VIOLATE)

**The test scenario is the specification. NO agent MUST alter, reorder, skip, or replace scenario steps to make a test pass.** This is a QA integrity principle — the purpose of the test is to verify the application behaves as the scenario describes, not to find any path that produces a green result.

**What the Executor CAN fix:**
- Locator path refinement (e.g., selector points to container instead of text node — narrow it). But NOT missing elements — if element is not in DOM at all, escalate to Explorer/Builder
- Import paths, TypeScript errors, missing dependencies (technical plumbing)
- Wait strategies (replacing hardcoded waits with proper Playwright waits)
- Page Object methods (fixing element interaction mechanics)
- Scroll adjustments, overlay dismissal (removing technical obstacles)
- `playwright.config.ts` and `framework-config.json` timeout values — **NOT in spec files. NEVER use `test.setTimeout()` or `page.setDefaultTimeout()` in spec files**

### Executor File Edit Scope — HARD BOUNDARIES

| Files | Executor Access | Notes |
|-------|----------------|-------|
| `output/tests/**/*.spec.ts` | **Edit** — timing waits, import fixes, assertion structure, ad blocking | Primary fix target |
| `output/pages/*.ts` | **Edit** — interaction method fixes (hover, pressSequentially, wait) | Page object fixes |
| `output/locators/*.json` | **Edit** — selector refinement only (narrow, not wholesale replace) | Selector refinement |
| `output/playwright.config.ts` | **Edit** — timeout values, browser config | **Config changes go HERE** |
| `framework-config.json` | **Edit** — timeout values only | **Config changes go HERE** |
| `output/test-data/{type}/*.json` | **Edit** — scenario-specific test data | Data fixes |
| `scenarios/app-contexts/*.md` | **Edit** — add discovered patterns | Pacing patterns |
| `output/core/*` | **READ ONLY** | Framework core — NEVER modify |
| `output/pages/*.helpers.ts` | **READ ONLY** | Team-owned — NEVER modify |
| `output/test-data/shared/*` | **READ ONLY** | Cross-scenario — NEVER modify |
| `scenarios/*.md` | **READ ONLY** | User-owned scenario — NEVER modify |
| All other files | **NO ACCESS** | Out of scope for Executor |

**Configuration Discipline:** Timeouts, browser settings, retry counts, and infrastructure configuration MUST ONLY be set in `output/playwright.config.ts` or `framework-config.json`. NEVER in spec files or page objects. The ONLY exception is step-specific `// PACING:` waits in specs.

**What NO agent MUST do:**
- Change the ORDER of scenario steps
- SKIP a step that the scenario defines
- Take an ALTERNATIVE FLOW not described in the scenario
- Modify ASSERTION VALUES that the scenario explicitly defines
- Add steps that aren't in the scenario to work around app behavior
- Simplify the test to avoid a difficult interaction

**If a scenario step cannot be executed as written** (e.g., the required widget is inaccessible, or the app's business logic prevents the expected outcome):
1. Wrap the test in `test.fixme('SCENARIO BLOCKED: Step N "[step description]" cannot be executed — [reason]')`
2. Document the exact blocker in the healer report
3. Do NOT attempt workarounds or alternative flows
4. The scenario author (human) decides whether to revise the scenario, file a bug, or request testability improvements

---

## 10. App-Context Files Are ADDITIVE

App-context files (`scenarios/app-contexts/*.md`) store learned patterns. They grow over time as more patterns are discovered.

**Who can write app-context files:**
- **Humans** — YES. Testers, developers, and QE leads can manually create or edit app-context files with known application patterns. This is encouraged for new app onboarding.
- **Explorer/Builder** — YES. Writes newly discovered patterns after exploration.
- **Executor** — YES. Writes pacing patterns discovered during fix cycles.
- **Enrichment Agent** — Read only (uses app-context to ask smarter questions).
- **Reviewer** — Read only.

**Rules:**
- **Patterns are ALWAYS additive** — NEVER remove existing patterns from an app-context file
- **If a pattern is outdated** — add a `**Superseded by:**` note, DO NOT delete the original
- **If two pipeline runs or a human + agent edit the same file** — all additions are valid. Keep all.
- **Human-authored patterns are equally authoritative** — agents MUST read and follow them just like agent-discovered patterns

---

## 11. Platform Compatibility

All agents must follow these rules for cross-platform operation:
- Use Node.js `path.join()` for all file paths (never hardcode `/` or `\`)
- DO NOT use git commands or check repository state
- Self-contained execution mode
- PROJECT ROOT: `output/` — all generated files go here. ONE shared project, not per-scenario
