# Agentic QE Framework v2

An enterprise-grade, multi-agent pipeline that converts test scenario descriptions into production-quality Playwright automation code. Write what you want to test in plain English. The agents explore your app, generate code, run it, review it, and fix it — autonomously.

```
Scenario .md  ──>  Scout  ──>  Explorer  ──>  Builder  ──>  Executor  ──>  Reviewer  ──>  Healer
(what to test)    (elements)  (verify flow)  (gen code)   (run & fix)   (audit)       (fix quality)
```

---

## Core Philosophy

### 1. Build What Works, Not What You Think Should Work

Every interaction is verified in a live browser before code is generated. The Explorer walks the app step by step. The Builder generates code only from verified observations — never from imagination.

### 2. Scripts for Evidence, LLMs for Judgment

Deterministic tasks (step counting, file diffing, result parsing, change classification) use **scripts** — zero LLM tokens. Reasoning tasks (browser interaction, code generation, bug detection) use the LLM. This keeps costs down and results reproducible.

### 3. Scenario Integrity Is Sacred

Agents **never** alter, skip, or reorder scenario steps to make tests pass. If a step fails, it's flagged — not silently removed. Expected values in VERIFY assertions are treated as ground truth.

### 4. Selectors Live in JSON, Not in Code

All element selectors are externalized to locator JSON files via `LocatorLoader`. Page objects reference selectors by key name — never by raw CSS or XPath strings. This makes maintenance a single-point-of-change operation.

### 5. Separation of Concerns

Each agent has one job and hard boundaries. The Explorer verifies flows but doesn't generate code. The Builder generates code but never opens a browser. The Executor fixes timing but doesn't rewrite scenarios. This prevents the context bloat and fabrication problems that plague monolithic agents.

---

## Architecture

### The Pipeline

```
┌──────────────────────────────────────────────────────────────────────┐
│  PRE-REQUISITE: Scout (ONE-TIME per app — user-driven, NOT a stage) │
│                                                                      │
│  STAGE 0: Enrichment (CONDITIONAL — if input is natural language)    │
│  ↓                                                                    │
│  STAGE 1-pre: Incremental Detection (scripts — zero LLM tokens)     │
│  ↓                                                                    │
│  STAGE 1a: Explorer (CONDITIONAL — verify flow in live browser)      │
│  ↓                                                                    │
│  STAGE 1b: Builder (generate/modify code from enriched.md)           │
│  ↓                                                                    │
│  STAGE 1-post: Cleanup annotations (script — zero LLM tokens)       │
│  ↓                                                                    │
│  STAGE 2: Executor (run tests + fix timing + heal Scout gaps)        │
│  ↓ [HARD GATE: verify test results before proceeding]                │
│  STAGE 3: Reviewer (precheck script + 9-dimension audit)            │
│  ↓ [if NEEDS FIXES]                                                   │
│  STAGE 4: Healer (CONDITIONAL — fix code quality issues)             │
│  ↓                                                                    │
│  OUTPUT: Pipeline Summary                                             │
└──────────────────────────────────────────────────────────────────────┘
```

### The Agents

| Agent | Browser? | Job | Key Output |
|-------|----------|-----|------------|
| **Scout** | YES | One-time element discovery — user navigates the app, Scout records selectors | `output/locators/*.locators.json` |
| **Enrichment Agent** | NO | Converts natural language or Swagger/OpenAPI specs into structured scenario `.md` | `scenarios/{type}/{name}.md` |
| **Explorer** | YES | Verifies scenario flow in a live browser, maps steps to pages | `{scenario}.enriched.md` + explorer report |
| **Builder** | NO | Generates Playwright page objects, spec files, and test data from enriched.md + locator JSONs | spec.ts + PageObject.ts + test-data.json |
| **Executor** | YES | Runs tests, fixes timing/selector issues, heals Scout gaps (max cycles configurable) | Fixed code + executor report |
| **Reviewer** | NO | Audits code against 9 quality dimensions, produces scorecard with verdict | Review scorecard (APPROVED / NEEDS FIXES) |
| **Healer** | NO | Fixes quality issues flagged by Reviewer, re-runs tests (max 2 cycles) | Healer report + fixed code |
| **Orchestrator** | NO | Coordinates all agents in sequence, enforces hard gates between stages | Pipeline summary |

### Incremental Updates

When you edit a scenario after the first pipeline run, the framework detects changes and does the minimum work:

| Pipeline Mode | What Happens |
|--------------|-------------|
| `FIRST_RUN` | Full exploration + full code generation (no existing spec) |
| `NO_CHANGES` | Skip Explorer + Builder entirely, re-run Executor to catch app regressions |
| `BUILDER_ONLY` | Skip Explorer (only VERIFY values or teardown text changed), Builder modifies only changed steps |
| `EXPLORER_REQUIRED` | Explorer fast-walks unchanged steps, deep-verifies only changed ones. Builder modifies only changed steps. |

The incremental pipeline preserves Executor-healed code (`// HEALED` selectors, `// PACING` waits) so you don't lose runtime fixes when regenerating.

---

## Prerequisites

- **Node.js** >= 18.0.0
- **Playwright** >= 1.50.0
- **VS Code** with GitHub Copilot (1.113+) **or** Claude Code CLI
- **MCP Playwright server** configured for Explorer's browser access

### Platform Support

| Platform | Agent Invocation | MCP Browser | Setup |
|----------|-----------------|-------------|-------|
| **Claude Code (CLI)** | `Agent` tool | Built-in MCP | Add Playwright MCP to `~/.claude/mcp_servers.json` or `.mcp.json` |
| **VS Code + Copilot** | `@QE Orchestrator` mention | Playwright MCP extension | Add to `.vscode/mcp.json`, enable `chat.subagents.allowInvocationsFromSubagents` |

---

## Setup

### 1. Initialize the Test Project

```bash
npm run setup
```

This creates the `output/` directory with:
- Playwright config (`playwright.config.ts`)
- Core utilities (`base-page.ts`, `locator-loader.ts`, `test-data-loader.ts`, `shared-state.ts`)
- `.env.example` with credential placeholders
- Scout tool (`tools/scout.config.ts`)

### 2. Configure Environment

```bash
cd output
cp .env.example .env
```

Edit `.env` with your application details:

```env
BASE_URL=https://your-app.example.com
TEST_USERNAME=your-test-user
TEST_PASSWORD="your-test-password"

# Optional — for API/hybrid scenarios
API_BASE_URL=https://api.your-app.example.com
API_TOKEN=your-api-token

# Optional — for SSO login
SSO_EMAIL=user@company.com
SSO_PASSWORD="sso-password"
```

### 3. Install Playwright Browsers

```bash
cd output
npm install
npx playwright install chromium
```

### 4. Configure MCP (for Explorer browser access)

**VS Code** — create/edit `.vscode/mcp.json`:
```json
{
  "servers": {
    "playwright": {
      "command": "npx",
      "args": ["@playwright/mcp@latest", "--isolated", "--browser", "chromium"]
    }
  }
}
```

**Claude Code CLI** — add to `.mcp.json` in project root or `~/.claude/mcp_servers.json`.

---

## Using the Framework

### Step 1: Run Scout (One-Time Per Application)

Scout discovers every interactive element in your application. You navigate manually; Scout records silently.

```bash
cd output
npx playwright test --config=tools/scout.config.ts --headed
```

A floating toolbar appears in the browser:
```
┌─────────────────────────────────────────┐
│  Scout Recording           ─            │
│  [Scan]  [Timed 5s]  [Done]            │
└─────────────────────────────────────────┘
```

- **Navigate** to each page of your application
- Click **Scan** (or **Timed 5s** for pages with lazy-loaded content) on each page
- Click **Done** when finished

**Output:**
- `output/locators/*.locators.json` — element selectors with primary + 2 fallbacks
- `output/scout-reports/{app}-page-inventory.json` — page summary with element counts

**When to re-run Scout:**
- After a major UI redesign
- When new pages/features are added
- When the Executor heals 5+ elements (it recommends a re-scan)

You do **not** re-run Scout for each scenario — all scenarios share the same locator files.

### Step 2: Write a Scenario

Create a `.md` file in `scenarios/{type}/`:

```markdown
# Checkout Flow

**Application:** My Store
**URL:** {{ENV.BASE_URL}}
**Type:** web
**Tags:** @smoke, @P0

## Steps

1. Navigate to {{ENV.BASE_URL}}
2. Enter {{ENV.TEST_USERNAME}} in the Username field
3. Enter {{ENV.TEST_PASSWORD}} in the Password field
4. Click the "Login" button
5. VERIFY dashboard displays "Welcome"
6. Click on "Products" in the navigation
7. Click "Add to Cart" on "Premium Widget"
8. VERIFY cart badge displays "1"
9. Click the cart icon
10. Click the "Checkout" button
11. VERIFY order summary displays "Premium Widget"
12. CAPTURE order total as {{orderTotal}}
13. Click "Place Order"
14. VERIFY confirmation displays "Order Placed Successfully"
15. SCREENSHOT order-confirmation
16. REPORT "Order placed with total: {{orderTotal}}"
```

**Scenario keywords:**

| Keyword | Purpose | Example |
|---------|---------|---------|
| `VERIFY` | Hard assertion — test fails if condition not met | `VERIFY cart badge displays "2"` |
| `VERIFY_SOFT` | Soft assertion — logged but doesn't fail the test | `VERIFY_SOFT banner shows "Sale"` |
| `CAPTURE` | Read a value from the page into a variable | `CAPTURE total as {{orderTotal}}` |
| `CALCULATE` | Pure arithmetic on captured values | `CALCULATE {{tax}} = {{subtotal}} * 0.08` |
| `SCREENSHOT` | Take a named screenshot | `SCREENSHOT checkout-complete` |
| `REPORT` | Log a message with variable interpolation | `REPORT "Total: {{orderTotal}}"` |
| `SAVE` | Persist a value for cross-scenario use | `SAVE {{orderId}} as orderId` |

**Supported scenario types:**

| Type | Fixture | Page Objects? | Locators? | Example |
|------|---------|:---:|:---:|---------|
| `web` | `{ page }` | Yes | Yes | Login, checkout, form submission |
| `api` | `{ request }` | No | No | REST CRUD, schema validation |
| `hybrid` | `{ page, request }` | Yes (UI only) | Yes (UI only) | Create via API, verify in UI |
| `mobile` | WDIO/Appium | Yes (screens) | Yes | Tap, swipe, native gestures |

**Multi-scenario files** — test related flows that share setup:

```markdown
## Common Setup
1. Navigate to {{ENV.BASE_URL}}
2. Login with admin credentials

### Scenario: Add Item
1. Click "Add Item"
2. VERIFY item appears in list

### Scenario: Remove Item
1. Click "Remove" on first item
2. VERIFY list is empty

## Common Teardown
1. Click "Logout"
```

### Step 3: Run the Pipeline

**With Claude Code CLI:**
```
Invoke @QE Orchestrator with scenario=checkout-flow type=web
```

**With VS Code Copilot:**
```
@QE Orchestrator scenario=checkout-flow type=web
```

**With optional folder organization:**
```
@QE Orchestrator scenario=checkout-flow type=web folder=my-store
```

The Orchestrator runs all stages automatically and produces a pipeline summary report at `output/reports/pipeline-summary-{scenario}.md`.

### Step 4: Review the Output

After a successful pipeline run, `output/` contains:

```
output/
├── core/                          # Framework runtime (read-only)
│   ├── base-page.ts
│   ├── locator-loader.ts
│   ├── test-data-loader.ts
│   └── shared-state.ts
├── pages/                         # Generated page objects
│   ├── LoginPage.ts
│   ├── InventoryPage.ts
│   └── CartPage.ts
├── locators/                      # Scout-discovered selectors
│   ├── login-page.locators.json
│   ├── inventory-page.locators.json
│   └── cart-page.locators.json
├── tests/
│   └── web/
│       └── checkout-flow.spec.ts  # Generated test spec
├── test-data/
│   └── web/
│       └── checkout-flow.json     # Test data
├── reports/
│   ├── explorer-report-checkout-flow.md
│   ├── builder-report-checkout-flow.md
│   ├── executor-report-checkout-flow.md
│   ├── review-scorecard-checkout-flow.md
│   └── pipeline-summary-checkout-flow.md
├── playwright.config.ts
└── .env
```

### Step 5: Run the Tests Independently

```bash
cd output

# Run all tests
npx playwright test

# Run a specific spec
npx playwright test tests/web/checkout-flow.spec.ts

# Run with headed browser
npx playwright test --headed

# Run with specific tag
npx playwright test --grep @smoke

# Run with HTML report
npx playwright test --reporter=html
```

---

## Incremental Workflow

After the first pipeline run, you can edit your scenario and re-run. The framework detects what changed and does only the necessary work.

### What Triggers Each Mode

| Your Edit | Pipeline Mode | Explorer Runs? | Builder Runs? |
|-----------|--------------|:-:|:-:|
| No changes | `NO_CHANGES` | No | No |
| Changed a VERIFY expected value (e.g., "$50" to "$75") | `BUILDER_ONLY` | No | Yes (modifies only that assertion) |
| Changed a teardown step | `BUILDER_ONLY` | No | Yes |
| Deleted a step | `BUILDER_ONLY` | No | Yes (comments out that test.step) |
| Changed an interaction (e.g., different button, different dropdown value) | `EXPLORER_REQUIRED` | Yes (fast-walks unchanged, deep-verifies changed) | Yes |
| Added a new step | `EXPLORER_REQUIRED` | Yes (fast-walks to reach state, deep-verifies new step) | Yes |

### How It Works Under the Hood

```
scenario-diff.js          →  classified-changeset.json (what changed, per section)
builder-incremental.js    →  annotated enriched.md (<!-- CHANGE: MODIFIED -->, <!-- WALK: DEEP -->)
Explorer (if needed)      →  updated enriched.md (verified changes in browser)
Builder                   →  modified spec (only changed test.step blocks)
cleanup-annotations.js    →  clean enriched.md (markers stripped, renumbered)
Executor                  →  full test run (catches regressions)
Reviewer + Healer         →  quality audit + fixes (as always)
```

### Multi-Scenario File Support

Incremental detection is **section-aware**. In a file with Common Setup + 3 Scenarios + Common Teardown:

- Editing Scenario A does **not** affect Scenarios B or C (no positional cascade)
- Editing Common Setup deep-verifies only the changed setup steps (not all scenarios)
- The Executor always runs the full spec (catches cross-scenario regressions)

---

## Features and Capabilities

### Test Generation

- **Page Object Model** — auto-generated page objects with `LocatorLoader` integration
- **Multi-language** — TypeScript (default), JavaScript, Python (sync API)
- **Multi-scenario files** — `Common Setup` / `Common Teardown` map to `beforeAll` / `beforeEach` / `afterAll` / `afterEach`
- **Data-driven tests** — `DATASETS` for parameterized tests, `SHARED_DATA` for cross-scenario immutable data
- **Locator fallbacks** — primary selector + 2 fallback strategies per element

### Scenario Types

- **Web** — Playwright page interactions with full POM support
- **API** — Playwright `request` fixture for REST testing (not axios/fetch)
- **Hybrid** — UI + API in the same test (create via API, verify in UI)
- **Mobile** — Appium MCP for Android/iOS native apps (tap, swipe, long-press)

### Quality Assurance

The Reviewer audits generated code across **9 dimensions**:

| # | Dimension | Weight | What It Checks |
|---|-----------|--------|----------------|
| 1 | Locator Quality | High | Primary + 2 fallbacks, no raw selectors |
| 2 | Wait Strategy | High | Proper waits, justified timeouts with `// PACING:` comments |
| 3 | Test Architecture | Medium | POM patterns, fixture usage, test data imports |
| 4 | Configuration | Medium | Timeouts in config, not hardcoded in specs |
| 5 | Code Quality | Low | TypeScript correctness, no unused imports |
| 6 | Maintainability | Medium | Single point of change, DRY |
| 7 | Security | High | No hardcoded credentials, `process.env.*` usage |
| 8 | API Test Quality | Medium | Request fixture, status assertions (api/hybrid only) |
| 9 | **Fidelity** | **Hard Gate** | Step count match, VERIFY/CAPTURE counts match, no skipped steps. **Must score >= 4/5 or verdict is NEEDS FIXES.** |

**Verdicts:**
- **APPROVED** — score >= 80%, all dimensions >= 3, Dim 9 >= 4, tests passing
- **APPROVED WITH CAVEATS** — approved but some steps are `test.fixme()` (potential app bugs)
- **NEEDS FIXES** — score < 80% or any dimension < 3 or Dim 9 < 4
- **TESTS FAILING** — tests still failing after Executor exhausted all cycles

### Browser Exploration

- **Scout** — one-time element discovery with toolbar UI (Scan, Timed, Done)
- **Explorer** — live flow verification with MCP Playwright
- **FAST-walk** — execute interactions for state without deep verification (incremental mode)
- **Bug detection** — 3-question decision gate classifies failures as test issue vs app bug
- **Selector healing** — Executor discovers missing elements at runtime via accessibility snapshots

### Automation Scripts (Zero LLM Tokens)

| Script | Command | Purpose |
|--------|---------|---------|
| Scenario diff | `node scripts/scenario-diff.js --scenario=path --spec=path` | Section-aware diff + change classification |
| Builder incremental | `node scripts/builder-incremental.js --scenario=X --type=web` | Annotate enriched.md, produce builder-instructions.json |
| Cleanup annotations | `node scripts/cleanup-annotations.js --file=path` | Strip markers, remove deleted steps, renumber |
| Explorer post-check | `node scripts/explorer-post-check.js --scenario=X --type=web` | Mechanical verification of step counts, locator counts |
| Review precheck | `node scripts/review-precheck.js --scenario=X --type=web` | Evidence collection before review (zero LLM tokens) |
| Test results parser | `node scripts/test-results-parser.js --results-dir=output/test-results` | Structured failure data from Playwright JSON |
| Failure classifier | `node scripts/failure-classifier.js --results=path` | Classify: Element Not Found vs Assertion vs Timeout vs Flake |
| Swagger parser | `node scripts/swagger-parser.js --spec=path` | Parse OpenAPI specs into scenario templates |
| Metrics collector | `node scripts/metrics-collector.js --run-type=pipeline` | Aggregate observability data across all stages |

### Skills System (Three-Level Progressive Disclosure)

28 skills across 6 domains, loaded on demand:

| Domain | Skills |
|--------|--------|
| **Web** (13) | navigate, interact, verify, wait, extract, scroll, frame, file-transfer, drag-drop, dialog, keyboard, multi-tab, network |
| **API** (3) | request, capture, validate-schema |
| **Auth** (3) | sso-login (Microsoft/OAuth/SAML), basic-login, storage-state |
| **Data** (2) | load (JSON/CSV), shared-data (immutable cross-scenario) |
| **Mobile** (6) | navigate, interact, verify, app-management, android-specific, ios-specific |
| **Accessibility** (2) | axe-audit (WCAG), aria-check |

### App-Contexts (Self-Improving Memory)

The Explorer reads known application patterns **before** exploring (saves time) and writes **new** patterns after exploring (next run is faster). Stored in `scenarios/app-contexts/{app}.md`.

Learned patterns include:
- UI framework (MUI, Fluent UI, Ant Design) and its pacing quirks
- Known popup/cookie consent handling
- Slow-loading components that need extra waits
- Authentication flow details

---

## Configuration

### `framework-config.json` — Agent Behavior

All agents read this file instead of using hardcoded values:

```json
{
  "exploration": {
    "maxAttemptsPerStep": 5,
    "snapshotTimeoutMs": 5000,
    "interactionTimeoutMs": 60000
  },
  "executor": {
    "maxCycles": 10,
    "preFlightEnabled": true
  },
  "timeouts": {
    "testTimeoutMs": 180000,
    "actionTimeoutMs": 30000,
    "navigationTimeoutMs": 60000,
    "networkIdleTimeoutMs": 30000
  },
  "builder": {
    "incrementalUpdate": true,
    "preserveHealedCode": true,
    "preservePacingComments": true
  },
  "bugDetection": {
    "uncertainVerdictEnabled": true,
    "flagDisabledElements": true,
    "flagEmptyValues": true
  }
}
```

### `output/playwright.config.ts` — Test Runner

Standard Playwright configuration. Generated by `setup.js` from templates. Controls:
- Browser (Chromium default), viewport (1920x1080)
- Reporters (list, JSON, HTML)
- Screenshots, video, trace on failure
- Timeout values (read from `framework-config.json`)

### `.env` — Credentials and URLs

All credentials use `process.env.*` — never hardcoded in generated code.

---

## File Ownership

Strict boundaries prevent agents from stepping on each other's work or modifying user-owned files:

| Files | Owner | Agent Access |
|-------|-------|-------------|
| `scenarios/*.md` | User/Tester | **Read only** — agents never modify scenario files |
| `scenarios/*.enriched.md` | Explorer (first run), then User | Explorer creates once. User can edit. Incremental pipeline annotates temporarily. |
| `output/pages/*.helpers.ts` | Team | **Read only** — agents never create, modify, or delete helper files |
| `output/test-data/shared/` | Team | **Read only** — immutable cross-scenario test data |
| `output/core/*` | Framework (`setup.js`) | **Read only** — base utilities |
| `output/pages/*.ts` | Builder | Create/modify (agents own these) |
| `output/locators/*.json` | Scout + Executor | Scout creates, Executor appends healed selectors |
| `output/tests/**/*.spec.ts` | Builder | Create/modify (agents own these) |
| `output/test-data/{type}/*.json` | Builder | Create/modify |
| `scenarios/app-contexts/*.md` | Explorer | Read/write (self-improving patterns) |

---

## CI/CD Integration

### Test Suites

Defined in `ci/config/ci-defaults.json`:

| Suite | Tag | Timeout | Retries |
|-------|-----|---------|---------|
| smoke | `@smoke` | 30 min | 0 |
| regression | `@regression` | 120 min | 1 |
| P0 | `@P0` | 60 min | 1 |
| P1 | `@P1` | 60 min | 0 |
| api | `@api` | 30 min | 0 |
| hybrid | `@hybrid` | 60 min | 1 |
| mobile | `@mobile` | 90 min | 1 |

### Running in CI

```bash
# Run a test suite
node ci/scripts/ci-test-runner.js --suite=smoke

# With defect tracking
node ci/scripts/ci-test-runner.js --suite=regression --tracker=jira
```

### Defect Tracking

Connectors for Jira and ServiceNow. Auto-close defects after N consecutive passes (configurable). Deduplication prevents duplicate tickets for the same failure.

---

## Limitations

| Area | Limitation | Workaround |
|------|-----------|------------|
| **Scout coverage** | Captures ~90% of elements. Rare custom components (canvas, Web Components with closed shadow DOM) may be missed. | Executor heals up to 3 missing elements per run. Re-run Scout after major UI changes. |
| **Canvas / pixel-based** | Cannot assert on canvas charts or pixel colors. Only SVG/DOM-rendered charts are readable. | Use SVG-based chart libraries, or add `data-testid` attributes to chart containers. |
| **Mobile** | Declared and partially implemented. Appium configuration is minimal. | Web and API types are production-ready. Mobile is functional but less battle-tested. |
| **CI/CD workflows** | GitHub Actions workflows are skeletal. Jira connector exists but is non-functional. | Use the `ci-test-runner.js` script directly. Build custom workflows around it. |
| **Single-scenario insertions** | Mid-section step insertions in single-scenario files (`## Steps`) cause positional cascade in the diff (more steps marked MODIFIED than necessary). | Not a correctness issue — just extra work. Multi-scenario files with `### Scenario:` blocks are unaffected. |
| **Context window** | Very large scenarios (50+ steps) may approach LLM context limits on some platforms. | Split into multi-scenario files with Common Setup/Teardown. |
| **Async Python** | Python code generation uses synchronous Playwright API only (no async/await). | Use TypeScript for async-heavy scenarios. |
| **No `{ force: true }`** | Agents never use `{ force: true }` on clicks (it masks real bugs). | If an element has a hit-area mismatch, Scout flags it. Fix the app or use a more specific selector. |

---

## Directory Structure

```
agentic-qe-framework-v2/
├── agents/
│   ├── core/                     # Agent instruction files (5,031 lines total)
│   │   ├── orchestrator.md       # Pipeline coordinator
│   │   ├── explorer.md           # Flow verification
│   │   ├── builder.md            # Code generation
│   │   ├── executor.md           # Test runner + healing
│   │   ├── reviewer.md           # 9-dimension quality audit
│   │   ├── healer.md             # Quality fixes
│   │   ├── enrichment-agent.md   # NL/Swagger → scenario
│   │   ├── code-generation-rules.md  # Locator, POM, spec patterns
│   │   ├── quality-gates.md      # Fidelity rules, guardrails
│   │   ├── scenario-handling.md  # Multi-scenario, DATASETS, app-context
│   │   └── bug-detection-rules.md    # Bug vs test issue classification
│   ├── shared/                   # Cross-agent references
│   │   ├── keyword-reference.md  # VERIFY, CAPTURE → TypeScript patterns
│   │   ├── guardrails.md         # File ownership boundaries
│   │   ├── type-registry.md      # web/api/hybrid/mobile behavior
│   │   └── path-resolution.md    # Single source of truth for paths
│   ├── claude/                   # Claude Code tool-mapping wrappers (7 files)
│   ├── 04-reviewer/              # Reviewer dimensions (9 files) + scorecard template
│   └── report-templates/         # Report output formats
├── .github/agents/               # VS Code Copilot agent wrappers (7 files)
├── scenarios/
│   ├── web/                      # Web test scenarios
│   ├── api/                      # API test scenarios
│   ├── hybrid/                   # Hybrid test scenarios
│   └── app-contexts/             # Learned application patterns
├── scripts/
│   ├── lib/
│   │   └── section-parser.js     # Shared section extraction utility
│   ├── scenario-diff.js          # Section-aware diff + change classification
│   ├── builder-incremental.js    # Annotate enriched.md for incremental builds
│   ├── cleanup-annotations.js    # Post-Builder marker cleanup
│   ├── explorer-post-check.js    # Mechanical post-exploration verification
│   ├── review-precheck.js        # Pre-review evidence collection
│   ├── test-results-parser.js    # Playwright result parser
│   ├── failure-classifier.js     # Failure triage (element/assertion/timeout/flake)
│   ├── swagger-parser.js         # OpenAPI → scenario templates
│   ├── metrics-collector.js      # Observability data aggregation
│   ├── eval-summary.js           # Agent evaluation summary
│   └── rehash-skills.js          # Skill content hash updater
├── skills/                       # 28 skills across 6 domains
│   ├── registry.md               # Skill discovery index
│   ├── web/                      # Web interaction skills
│   ├── api/                      # API testing skills
│   ├── auth/                     # Authentication skills
│   ├── data/                     # Data loading skills
│   ├── mobile/                   # Mobile testing skills
│   └── accessibility/            # A11y audit skills
├── contracts/                    # Agent input/output manifests (8 files)
├── templates/                    # Config and core file templates
│   ├── config/                   # TypeScript project template
│   ├── config-javascript/        # JavaScript variant
│   ├── config-python/            # Python variant
│   ├── core/                     # Core utilities (TypeScript)
│   └── core-python/              # Core utilities (Python)
├── ci/                           # CI/CD configuration
│   ├── config/ci-defaults.json   # Test suite definitions
│   ├── scripts/ci-test-runner.js # CI test runner
│   └── integrations/             # Jira, ServiceNow connectors
├── output/                       # Generated Playwright test project
│   ├── core/                     # Runtime utilities (from templates)
│   ├── pages/                    # Generated page objects
│   ├── locators/                 # Scout-discovered selectors
│   ├── tests/                    # Generated spec files
│   ├── test-data/                # Test data (per-scenario + shared)
│   ├── tools/                    # Scout tool
│   └── reports/                  # Pipeline reports and metrics
├── framework-config.json         # User-configurable agent settings
├── CLAUDE.md                     # Claude Code framework instructions
└── .github/copilot-instructions.md  # Copilot framework instructions
```

---

## Example Scenarios

The repository includes two tested scenarios:

### Orange HRM (Multi-Scenario)
`scenarios/web/orangehrm/employee-portal.md` — Common Setup (login) + 3 scenarios (Apply Leave, Search Employee Directory, Post Buzz Message) + Common Teardown (logout). Tests section-aware incremental detection with isolated scenario changes.

### SauceDemo (Single Scenario)
`scenarios/web/saucedemo/checkout-flow.md` — 24-step checkout flow (login, add to cart, checkout, confirm). Live browser-verified against https://www.saucedemo.com. Tests incremental detection for single-section files.

---

## Contributing

### Adding a New Scenario
1. Create `scenarios/{type}/{folder}/{scenario-name}.md` using the template in `scenarios/web/_template.md`
2. Run Scout on the application if locator files don't exist yet
3. Invoke the Orchestrator: `@QE Orchestrator scenario={name} type={type} folder={folder}`

### Adding a New Skill
1. Create `skills/{domain}/{skill-name}.skill.md` with full instructions
2. Add a one-line entry to `skills/registry.md`
3. Run `node scripts/rehash-skills.js` to update content hashes

### Modifying Agent Behavior
- **Configurable values** go in `framework-config.json` (timeouts, retries, cycle limits)
- **Behavioral rules** go in `agents/core/{agent}.md` (instructions the LLM follows)
- **Code patterns** go in `agents/core/code-generation-rules.md` or `agents/shared/keyword-reference.md`
- **Never hardcode** values that should be configurable — agents read from `framework-config.json`

---

## License

Proprietary. All rights reserved.
