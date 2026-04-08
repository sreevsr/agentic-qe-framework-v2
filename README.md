# Agentic QE Framework v2

An enterprise-grade, multi-agent pipeline that converts test scenario descriptions into production-quality Playwright automation code. Write what you want to test in plain English. The agents explore your app, generate code, run it, review it, and fix it — autonomously.

```
Scenario .md  ──>  Explorer  ──>  Builder  ──>  Executor  ──>  Reviewer  ──>  Healer
(what to test)    (verify flow    (gen code)   (run & fix)   (audit)       (fix quality)
                   + capture
                   selectors)
```

---

## Quick Start

Get a sample test running in under 10 minutes:

```bash
# 1. Install and initialize
npm install
npm run setup

# 2. Configure credentials
cd output
cp .env.example .env
# Edit .env — fill in BASE_URL, TEST_USERNAME, TEST_PASSWORD

# 3. Install Playwright browsers
npm install
npx playwright install chromium

# 4. Reload VS Code window (so MCP server starts)
# Ctrl+Shift+P → "Developer: Reload Window"

# 5. Run the Explorer (in Copilot chat)
# @QE Explorer Run Explorer for scenario saucedemo/checkout-flow, type web.
# Input: scenarios/web/saucedemo/checkout-flow.md

# 6. Run the Builder (in a new Copilot chat)
# @QE Builder Run Builder for scenario saucedemo/checkout-flow, type web.
# Input: scenarios/web/saucedemo/checkout-flow.enriched.md

# 7. Run the test
cd output && npx playwright test tests/web/saucedemo/checkout-flow.spec.ts --headed
```

For full setup details and all options, read on.

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
│  STAGE 0: Enrichment (CONDITIONAL — if input is natural language)    │
│  ↓                                                                    │
│  STAGE 1-pre: Incremental Detection (scripts — zero LLM tokens)     │
│  ↓                                                                    │
│  STAGE 1a: Explorer (verify flow + capture selectors in live browser)│
│  ↓                                                                    │
│  STAGE 1b: Builder (extract ELEMENT annotations → locator JSONs +   │
│            page objects + spec from enriched.md)                      │
│  ↓                                                                    │
│  STAGE 1-post: Cleanup annotations (script — zero LLM tokens)       │
│  ↓                                                                    │
│  STAGE 2: Executor (run tests + fix timing issues)                   │
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
| **Enrichment Agent** | NO | Converts natural language or Swagger/OpenAPI specs into structured scenario `.md` | `scenarios/{type}/{name}.md` |
| **Explorer** | YES | Verifies scenario flow in a live browser, captures element selectors from MCP snapshot (DOM probe fallback for non-accessible elements), maps steps to pages | `{scenario}.enriched.md` (with ELEMENT annotations) + explorer report |
| **Builder** | NO | Extracts ELEMENT annotations from enriched.md → creates locator JSONs, page objects, spec files, and test data | locators.json + PageObject.ts + spec.ts + test-data.json |
| **Executor** | YES | Runs tests, fixes timing/selector issues (max cycles configurable) | Fixed code + executor report |
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

The incremental pipeline preserves Executor-healed selectors (`"_healed": true` in locator JSONs) and `// PACING` waits so you don't lose runtime fixes when regenerating.

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

# Browser mode — set to false to see the browser during test runs
HEADLESS=false
```

**Headed vs headless:** Set `HEADLESS=false` in `.env` to see the browser window during test execution. This is recommended during development and debugging. Set `HEADLESS=true` for CI/CD runs. The `playwright.config.ts` reads this variable automatically.

### 3. Install Playwright Browsers

```bash
cd output
npm install
npx playwright install chromium
```

### 4. Configure MCP (for Explorer browser access)

**VS Code** — `npm run setup` auto-generates `.vscode/mcp.json` with the correct `npx` path for your environment. If you use **nvm, fnm, or volta**, this is critical — bare `npx` won't be on the default PATH and the Explorer will fail with "no Browser MCP." If you need to create it manually:

```json
{
  "servers": {
    "playwright": {
      "command": "/full/path/to/npx",
      "args": ["@playwright/mcp@latest", "--isolated", "--browser", "chromium"]
    }
  }
}
```

Find your `npx` path: `which npx` (Linux/Mac) or `where npx` (Windows). After editing, **reload the VS Code window** (`Ctrl+Shift+P` → "Developer: Reload Window") for the MCP server to start.

**Claude Code CLI** — add to `.mcp.json` in project root or `~/.claude/mcp_servers.json`.

---

## Using the Framework

### Step 1: Write a Scenario

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

### Step 2: Run the Pipeline

#### Agent Prompts — Quick Reference

Each agent can be invoked with a short prompt or a detailed prompt. Short prompts work when the agent can infer defaults. Detailed prompts are explicit — use them when the short form doesn't pick up the right files.

**VS Code Copilot** — run each agent in a **fresh chat session** (never chain agents in the same chat):

| Agent | Short Prompt | Detailed Prompt |
|-------|-------------|----------------|
| **Enricher** | `@QE Enricher Enrich scenario checkout-flow, type web` | `@QE Enricher Convert the following description into a structured scenario .md file, type web. Save to scenarios/web/checkout-flow.md` |
| **Explorer** | `@QE Explorer Run Explorer for scenario checkout-flow, type web` | `@QE Explorer Run Explorer for scenario checkout-flow, type web. Input: scenarios/web/checkout-flow.md` |
| **Builder** | `@QE Builder Run Builder for scenario checkout-flow, type web` | `@QE Builder Run Builder for scenario checkout-flow, type web. Input: scenarios/web/checkout-flow.enriched.md` |
| **Executor** | `@QE Executor Run Executor for scenario checkout-flow, type web` | `@QE Executor Run Executor for scenario checkout-flow, type web. Spec: output/tests/web/checkout-flow.spec.ts` |
| **Reviewer** | `@QE Reviewer Review scenario checkout-flow, type web` | `@QE Reviewer Run Reviewer for scenario checkout-flow, type web. Spec: output/tests/web/checkout-flow.spec.ts` |
| **Healer** | `@QE Healer Fix scenario checkout-flow` | `@QE Healer Fix issues from review scorecard for scenario checkout-flow. Scorecard: output/reports/review-scorecard-checkout-flow.md` |

**Claude Code CLI** — same prompts work, or use the Orchestrator for the full pipeline:

| Agent | Short Prompt |
|-------|-------------|
| **Orchestrator** | `@QE Orchestrator scenario=checkout-flow type=web` |
| **Explorer** | `@QE Explorer scenario=checkout-flow type=web` |
| **Builder** | `@QE Builder scenario=checkout-flow type=web` |
| **Executor** | `@QE Executor scenario=checkout-flow type=web` |
| **Reviewer** | `@QE Reviewer scenario=checkout-flow type=web` |
| **Healer** | `@QE Healer scenario=checkout-flow` |

**With folder organization (both platforms):** add `folder=my-store` to any prompt.

---

#### VS Code Copilot — Run Agents Individually (Recommended)

The Orchestrator runs all stages in one context window, which frequently exhausts Copilot's 200K shared context on non-trivial scenarios. **Run each agent separately in a fresh Copilot chat session.** Scripts run in the terminal (zero LLM tokens, milliseconds).

**First run (no existing spec):**

| Step | Where | What to do |
|------|-------|-----------|
| **0. Enricher** | Copilot chat | Only if your input is natural language (not a structured .md). Produces `scenarios/web/checkout-flow.md`. |
| **1. Explorer** | Copilot chat (new session) | Walks the app in a live browser, captures selectors, produces `checkout-flow.enriched.md` |
| **2. Builder** | Copilot chat (new session) | Generates locator JSONs, page objects, spec, test data from enriched.md |
| **3. Test** | Terminal: `cd output && npx playwright test tests/web/checkout-flow.spec.ts --headed` | Run the test directly — if it passes, skip the Executor |
| **4. Executor** | Copilot chat (new session) | Only if step 3 fails — fixes timing/selector issues (max cycles configurable) |
| **5. Reviewer** | Copilot chat (new session) | Audits code quality across 9 dimensions, produces scorecard |
| **6. Healer** | Copilot chat (new session) | Only if Reviewer verdict is NEEDS FIXES — fixes quality issues, then re-run test and Reviewer to verify |

**Incremental run (scenario edited after first run):**

| Step | Where | What to do |
|------|-------|-----------|
| **1. Diff** | Terminal: `node scripts/scenario-diff.js --scenario=scenarios/web/checkout-flow.md` | Detects changes, shows pipeline mode: `NO_CHANGES` / `BUILDER_ONLY` / `EXPLORER_REQUIRED` |
| **2. Annotate** | Terminal: `node scripts/builder-incremental.js --scenario=checkout-flow --type=web` | Marks enriched.md with CHANGE/WALK annotations |
| **3. Explorer** | Copilot chat | Only if step 1 shows `EXPLORER_REQUIRED`. Add to prompt: `INCREMENTAL mode — FAST-walk unchanged, DEEP-verify changed.` |
| **4. Cleanup** | Terminal: `node scripts/cleanup-annotations.js --file=scenarios/web/checkout-flow.enriched.md` | Strips markers, renumbers steps |
| **5. Builder** | Copilot chat (new session) | Add to prompt: `INCREMENTAL mode — builder-instructions.json exists.` |
| **6-8.** | | Test → Executor → Reviewer → Healer (same as first run) |

**Important — Copilot tips:**
- **Fresh chat session per agent.** Never chain agents in the same chat — each needs maximum context for its own work.
- **Test before Executor.** Run `npx playwright test --headed` in terminal first. If it passes, skip the Executor entirely and go straight to Reviewer.
- **If an agent hangs or VS Code freezes** — close the chat session and re-run in a new one. Don't wait — context is already exhausted.
- **Reviewer and Healer don't need MCP.** They can run in Claude Code CLI if Copilot context is tight.

#### Claude Code CLI — Orchestrator or Individual Agents

Claude Code CLI gives each subagent its own context window, so the Orchestrator works reliably:

```
@QE Orchestrator scenario=checkout-flow type=web
```

The Orchestrator runs all stages automatically and produces a pipeline summary report at `output/reports/pipeline-summary-{scenario}.md`.

You can also run agents individually with the prompts above — useful when you want to inspect output between stages.

### Step 3: Review the Output

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
├── locators/                      # Element selectors (created by Builder from Explorer's ELEMENT annotations)
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

### Step 4: Run the Tests Independently

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

After the first pipeline run, you can edit your scenario and re-run. The framework detects what changed and does only the necessary work. For step-by-step commands, see **Step 2 → Incremental run** above.

### What Triggers Each Mode

| Your Edit | Pipeline Mode | Explorer Runs? | Builder Runs? |
|-----------|--------------|:-:|:-:|
| No changes | `NO_CHANGES` | No | No |
| Changed a VERIFY expected value (e.g., "$50" to "$75") | `BUILDER_ONLY` | No | Yes (modifies only that assertion) |
| Changed a teardown step | `BUILDER_ONLY` | No | Yes |
| Deleted a step | `BUILDER_ONLY` | No | Yes (comments out that test.step) |
| Changed an interaction (e.g., different button, different dropdown value) | `EXPLORER_REQUIRED` | Yes (fast-walks unchanged, deep-verifies changed) | Yes |
| Added a new step | `EXPLORER_REQUIRED` | Yes (fast-walks to reach state, deep-verifies new step) | Yes |

### Multi-Scenario File Support

Incremental detection is **section-aware**. In a file with Common Setup + 3 Scenarios + Common Teardown:

- Editing Scenario A does **not** affect Scenarios B or C (no positional cascade)
- Editing Common Setup deep-verifies only the changed setup steps (not all scenarios)
- The Executor always runs the full spec (catches cross-scenario regressions)

---

## API Test Automation

The framework supports REST API testing using Playwright's `request` fixture — no browser needed. API scenarios skip the Explorer (no UI to verify) and go directly to the Builder.

### Writing an API Scenario

Create a `.md` file in `scenarios/api/`:

```markdown
# CRUD Operations — Posts API

## Metadata
- **Priority:** P0
- **Type:** api
- **Tags:** smoke, api, crud

## Application
- **URL:** {{ENV.API_BASE_URL}}
- **Auth:** Bearer token via {{ENV.API_TOKEN}}

## API Behavior: mock

## Steps

1. API GET: /posts — retrieve all posts
2. VERIFY: Response status is 200
3. VERIFY: Response body is a non-empty array

4. API POST: /posts with body {"title": "Test Post", "body": "Test content", "userId": 1}
5. VERIFY: Response status is 201
6. VERIFY: Response body contains "title" = "Test Post"
7. CAPTURE: Response body "id" as {{newPostId}}

8. API GET: /posts/1 — retrieve a single post
9. VERIFY: Response status is 200
10. VERIFY: Response body contains "id" = 1

11. API PUT: /posts/1 with body {"id": 1, "title": "Updated Title", "body": "Updated body", "userId": 1}
12. VERIFY: Response status is 200
13. VERIFY: Response body contains "title" = "Updated Title"

14. API PATCH: /posts/1 with body {"title": "Patched Title"}
15. VERIFY: Response status is 200
16. VERIFY: Response body contains "title" = "Patched Title"

17. API DELETE: /posts/1
18. VERIFY: Response status is 200

19. SCREENSHOT: api-test-summary
20. REPORT: "CRUD operations completed. Created post ID: {{newPostId}}"
```

**Key differences from web scenarios:**
- **Type is `api`** — uses `{ request }` fixture, not `{ page }`
- **No Explorer needed** — API scenarios have no UI to explore. The pipeline goes straight to Builder.
- **No page objects or locator JSONs** — API tests use `request.get()`, `request.post()`, etc. directly
- **`## API Behavior: mock`** — declares the API is non-persistent (fake). Omit this line or set to `live` for real APIs where POST-then-GET must find the created resource.

### Using a Swagger/OpenAPI Spec

If you have a Swagger spec (JSON or YAML), the framework can generate scenarios from it:

```bash
# From a local spec file
node scripts/swagger-parser.js --spec=scenarios/api/swagger-specs/my-api.json

# Download a spec from a URL first
curl -o scenarios/api/swagger-specs/my-api.json https://your-api.com/swagger/v1/swagger.json

# If the spec URL requires authentication
curl -H "Authorization: Bearer YOUR_TOKEN" \
     -o scenarios/api/swagger-specs/my-api.json \
     https://your-api.com/swagger/v1/swagger.json
```

Common spec URL patterns by framework:

| Backend Framework | Spec URL |
|------------------|----------|
| .NET / ASP.NET | `/swagger/v1/swagger.json` |
| Spring Boot | `/v3/api-docs` |
| Express (swagger-jsdoc) | `/api-docs` |
| FastAPI | `/openapi.json` |
| Django REST | `/swagger.json` or `/openapi/` |

You can also use the Enricher agent with a Swagger spec:

```
@QE Enricher Parse swagger spec at scenarios/api/swagger-specs/my-api.json and generate API test scenarios
```

### Authentication

All credentials go in `output/.env` — never hardcoded in scenarios or generated code.

**Bearer Token:**
```env
API_BASE_URL=https://your-api.com
API_TOKEN=your-bearer-token
```

```markdown
## Steps
1. API GET: /users with Authorization: Bearer {{ENV.API_TOKEN}}
2. VERIFY: Response status is 200
```

The Builder generates: `request.get('/users', { headers: { Authorization: \`Bearer ${process.env.API_TOKEN}\` } })`

**API Key:**
```env
API_KEY=your-api-key
```

```markdown
## Steps
1. API GET: /data with header X-API-Key: {{ENV.API_KEY}}
```

**Basic Auth:**
```env
API_USERNAME=your-username
API_PASSWORD=your-password
```

```markdown
## Steps
1. API GET: /secure/data with Basic Auth {{ENV.API_USERNAME}} / {{ENV.API_PASSWORD}}
```

**OAuth2 Client Credentials (token acquisition in Common Setup):**
```markdown
## Common Setup
1. API POST: /oauth/token with body {"grant_type": "client_credentials", "client_id": "{{ENV.CLIENT_ID}}", "client_secret": "{{ENV.CLIENT_SECRET}}"}
2. VERIFY: Response status is 200
3. CAPTURE: Response body "access_token" as {{accessToken}}

### Scenario: List Users
1. API GET: /users with Authorization: Bearer {{accessToken}}
2. VERIFY: Response status is 200
```

### Running API Tests

The pipeline for API scenarios is shorter — no Explorer, no MCP browser:

| Step | Where | What to do |
|------|-------|-----------|
| **1. Builder** | Copilot or Claude Code | `@QE Builder Run Builder for scenario my-api-test, type api` |
| **2. Test** | Terminal | `cd output && npx playwright test tests/api/my-api-test.spec.ts` |
| **3. Executor** | Copilot (only if test fails) | `@QE Executor Run Executor for scenario my-api-test, type api` |
| **4. Reviewer** | Copilot or Claude Code | `@QE Reviewer Review scenario my-api-test, type api` |

**No Explorer needed.** API scenarios don't have a UI to explore — the Builder reads the scenario `.md` directly and generates the spec. This makes API test automation significantly faster than web.

### Mock vs Live APIs

The `## API Behavior` header in the scenario controls how strictly the framework enforces CRUD persistence:

| Header | Meaning | Guardrail behavior |
|--------|---------|-------------------|
| `## API Behavior: mock` | API is fake/non-persistent (e.g., JSONPlaceholder, MockAPI) | POST-then-GET not finding the resource is expected — not flagged as a bug |
| `## API Behavior: live` or omitted | API is real and persistent | POST returns 201 but GET returns 404 = **flagged as POTENTIAL BUG** |

Always declare `mock` for public test APIs like JSONPlaceholder, ReqRes, or any mock server. Omit it (or set `live`) for your real application APIs.

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

- **Explorer** — live flow verification + element capture with MCP Playwright. Snapshot-first strategy: derives selectors from the MCP accessibility snapshot (role, name, href). DOM probe fallback for non-accessible elements (SVGs, DOM-only panels, custom widgets).
- **Selector validation gate** — every non-structural selector is validated against the live DOM (`querySelectorAll` count === 1) before recording. Prevents ambiguous selectors that match multiple elements.
- **FAST-walk** — execute interactions for state without deep verification (incremental mode)
- **Bug detection** — 3-question decision gate classifies failures as test issue vs app bug
- **Iframe-aware** — validation runs in the same frame context as the interaction. Shadow DOM elements skip CSS validation and rely on MCP interaction success as proof.

### Automation Scripts (Zero LLM Tokens)

| Script | Command | Purpose |
|--------|---------|---------|
| Scenario diff | `node scripts/scenario-diff.js --scenario=path` | Section-aware diff + change classification (auto-detects enriched.md, falls back to spec) |
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
  },
  "chunking": {
    "maxStepsPerChunk": 15,
    "alwaysChunk": false
  },
  "appContext": {
    "filename": "my-app.md"
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
| `output/locators/*.json` | Builder + Executor | Builder creates from Explorer's ELEMENT annotations, Executor refines selectors |
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

## Troubleshooting

| Problem | Cause | Fix |
|---------|-------|-----|
| Explorer says "no Browser MCP" or "MCP tools not available" | Playwright MCP server not running or `npx` path wrong in `.vscode/mcp.json` | Run `npm run setup` (auto-patches path). If manual: use `which npx` to find the full path, update `.vscode/mcp.json`, reload VS Code window. |
| Explorer or Executor says "`.env` not found" but the file exists | `.env` is in `.gitignore` — Copilot's file search tools skip gitignored files | The agent should read by exact path (`output/.env`), not search. If it persists, tell the agent: "Read the file at output/.env directly." |
| VS Code freezes or crashes during agent run | Context window exhausted — the agent consumed all 200K tokens | Kill the session. Re-run the agent in a fresh Copilot chat. For long scenarios (40+ steps), expect this. |
| Executor loops on the same error for multiple cycles | Same-root-cause detector may not trigger if error messages differ slightly between cycles | Check the executor report — if the same step fails every cycle, the issue is likely a bad selector from the Explorer. Fix the locator JSON manually and re-run the test. |
| Test runs in headless mode (no browser window) | `HEADLESS=true` in `output/.env` | Set `HEADLESS=false` in `output/.env`. No code changes needed — `playwright.config.ts` reads this variable. |
| Test passes locally but fails on a fresh machine | SSO session cookie from a previous browser session — the Explorer may have skipped login verification | Ensure the spec handles both SSO-redirect and active-session paths. Check `SSOLoginPage.login()` for the URL check. |
| Builder overwrites Executor's selector fixes | Executor-healed selectors not marked with `"_healed": true` | Manually add `"_healed": true` to the locator JSON entry. The Builder will preserve it on future regenerations. |
| `scenario-diff.js` classifies everything as FIRST_RUN | No enriched.md found next to the scenario file | Run the Explorer first to produce the enriched.md. The diff compares scenario .md against enriched .md (not the spec). |
| App-context file not found by Executor or Explorer | Agents guessing the filename from URL/domain instead of reading config | Set `appContext.filename` in `framework-config.json` to the exact filename in `scenarios/app-contexts/`. |

---

## Limitations

| Area | Limitation | Workaround |
|------|-----------|------------|
| **Element capture** | Snapshot-first capture covers ~85% of elements. Non-accessible elements (SVGs, DOM-only panels, shadow DOM) require DOM probe fallback. Closed shadow DOM elements skip CSS validation entirely. | DOM probe automatically kicks in for elements not in the accessibility snapshot. Shadow DOM elements rely on MCP interaction success as validation. |
| **Canvas / pixel-based** | Cannot assert on canvas charts or pixel colors. Only SVG/DOM-rendered charts are readable. | Use SVG-based chart libraries, or add `data-testid` attributes to chart containers. |
| **Mobile** | Declared and partially implemented. Appium configuration is minimal. | Web and API types are production-ready. Mobile is functional but less battle-tested. |
| **CI/CD workflows** | GitHub Actions workflows are skeletal. Jira connector exists but is non-functional. | Use the `ci-test-runner.js` script directly. Build custom workflows around it. |
| **Single-scenario insertions** | Mid-section step insertions in single-scenario files (`## Steps`) cause positional cascade in the diff (more steps marked MODIFIED than necessary). | Not a correctness issue — just extra work. Multi-scenario files with `### Scenario:` blocks are unaffected. |
| **Context window** | Very large scenarios (50+ steps) may approach LLM context limits on some platforms. | Split into multi-scenario files with Common Setup/Teardown. |
| **Async Python** | Python code generation uses synchronous Playwright API only (no async/await). | Use TypeScript for async-heavy scenarios. |
| **No `{ force: true }`** | Agents never use `{ force: true }` on clicks (it masks real bugs). | If an element has a hit-area mismatch, the Explorer flags it. Fix the app or use a more specific selector. |

---

## Directory Structure

```
agentic-qe-framework-v2/
├── agents/
│   ├── core/                     # Agent instruction files (5,031 lines total)
│   │   ├── orchestrator.md       # Pipeline coordinator
│   │   ├── explorer.md           # Flow verification + element capture (snapshot-first)
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
│   ├── locators/                 # Element selectors (Builder-created from Explorer ELEMENT annotations)
│   ├── tests/                    # Generated spec files
│   ├── test-data/                # Test data (per-scenario + shared)
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
2. Configure MCP Playwright (if not already done) — see Setup Step 4
3. Set `appContext.filename` in `framework-config.json` if onboarding a new application
4. Run the pipeline — see Step 2 above (individual agents recommended for Copilot, Orchestrator works on Claude Code CLI)

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
