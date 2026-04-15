# Agentic QE Framework v2

An enterprise-grade, multi-agent pipeline that converts test scenario descriptions into production-quality test automation code for **web, API, hybrid, and mobile** targets. Write what you want to test in plain English. The agents explore your app, generate code, run it, review it, and fix it — autonomously.

```
Scenario .md  ──>  Explorer  ──>  Builder  ──>  Executor  ──>  Reviewer  ──>  Healer
(what to test)    (verify flow    (gen code)   (run & fix)   (audit)       (fix quality)
                   + capture
                   selectors)
```

> **🆕 Mobile Feature Parity (Android GA):** Full WDIO + Appium pipeline for native mobile apps, at feature parity with the Playwright pipeline. BaseScreen with 15 reusable interaction methods, mobile locator loader with platform-keyed fallbacks, lifecycle hooks (`before`/`beforeEach`/`afterEach`/`after`), `VERIFY_SOFT` / `DATASETS` / `SHARED_DATA` / `USE_HELPER` keywords, auto-evidence (screenshot + page source + video) on failure, multi-spec runs via `beforeSuite` app reset, and multi-device cloud integration (BrowserStack, Sauce Labs, LambdaTest, AWS Device Farm). **Android is Generally Available** (device-verified). **iOS is supported at the config level but not yet device-verified** — see [iOS Support Status](#ios-support-status). See [Mobile Test Automation](#mobile-test-automation) below. Release tag: [`mobile-parity-android-ga`](https://github.com/sreevsr/agentic-qe-framework-v2/releases/tag/mobile-parity-android-ga).

---

<details>
<summary><b>📖 Table of Contents</b> (click to expand)</summary>

- [Quick Start](#quick-start)
  - [Web Quick Start](#web-quick-start)
  - [Mobile Quick Start (Android)](#mobile-quick-start-android)
- [Core Philosophy](#core-philosophy)
- [Architecture](#architecture)
  - [The Pipeline](#the-pipeline)
  - [The Agents](#the-agents)
  - [Incremental Updates](#incremental-updates)
- [Prerequisites](#prerequisites)
  - [Platform Support](#platform-support)
  - [Scenario Type Support](#scenario-type-support)
- [Setup](#setup)
  - [1. Initialize the Test Project](#1-initialize-the-test-project)
  - [2. Configure Environment](#2-configure-environment)
  - [3. Install Playwright Browsers](#3-install-playwright-browsers)
  - [4. Configure MCP Servers (Explorer live-app access)](#4-configure-mcp-servers-explorer-live-app-access)
- [Using the Framework](#using-the-framework)
  - [Step 1: Write a Scenario](#step-1-write-a-scenario)
  - [Step 2: Run the Pipeline](#step-2-run-the-pipeline)
  - [Step 3: Review the Output](#step-3-review-the-output)
  - [Step 4: Run the Tests Independently](#step-4-run-the-tests-independently)
- [Incremental Workflow](#incremental-workflow)
- [API Test Automation](#api-test-automation)
  - [Writing an API Scenario](#writing-an-api-scenario)
  - [Using a Swagger/OpenAPI Spec](#using-a-swaggeropenapi-spec)
  - [Authentication](#authentication)
  - [Running API Tests](#running-api-tests)
  - [Mock vs Live APIs](#mock-vs-live-apis)
- [Mobile Test Automation](#mobile-test-automation)
  - [iOS Support Status](#ios-support-status)
  - [Mobile Platform Targeting — `Platform:` Header Convention](#mobile-platform-targeting--platform-header-convention)
  - [Writing a Mobile Scenario](#writing-a-mobile-scenario)
  - [Setup — Android](#setup--android)
  - [Customer-Provided APK + Emulator Flow](#customer-provided-apk--emulator-flow)
  - [Setup — iOS](#setup--ios-macos-only-not-yet-device-verified)
  - [Running Mobile Tests](#running-mobile-tests)
  - [Multi-Device Parallelism](#multi-device-parallelism)
  - [Mobile Anti-Patterns (AP-1 through AP-7)](#mobile-anti-patterns-ap-1-through-ap-7)
  - [Mobile Failure Signatures](#mobile-failure-signatures)
  - [Auto-Evidence on Failure](#auto-evidence-on-failure)
  - [Mobile Example Scenarios](#mobile-example-scenarios)
- [Onboarding Guides](#onboarding-guides) ⭐ **Start here for new team members**
- [Features and Capabilities](#features-and-capabilities)
  - [Test Generation](#test-generation)
  - [Scenario Types](#scenario-types)
  - [Quality Assurance](#quality-assurance)
  - [Browser + Mobile App Exploration](#browser--mobile-app-exploration)
  - [Automation Scripts (Zero LLM Tokens)](#automation-scripts-zero-llm-tokens)
  - [Skills System (Three-Level Progressive Disclosure)](#skills-system-three-level-progressive-disclosure)
  - [App-Contexts (Self-Improving Memory)](#app-contexts-self-improving-memory)
- [Configuration](#configuration)
  - [`framework-config.json` — Agent Behavior](#framework-configjson--agent-behavior)
  - [`output/playwright.config.ts` — Web / API / Hybrid Test Runner](#outputplaywrightconfigts--web--api--hybrid-test-runner)
  - [`output/wdio.conf.ts` — Mobile Test Runner (WDIO + Appium)](#outputwdioconfts--mobile-test-runner-wdio--appium)
  - [`.env` — Credentials, URLs, Mobile Config](#env--credentials-urls-mobile-config)
- [File Ownership](#file-ownership)
- [CI/CD Integration](#cicd-integration)
- [Troubleshooting](#troubleshooting)
- [Limitations](#limitations)
- [Directory Structure](#directory-structure)
- [Example Scenarios](#example-scenarios)
- [Contributing](#contributing)
- [License](#license)

</details>

---

## Quick Start

Get a sample test running in under 10 minutes. There are two paths — **web** (Playwright) and **mobile** (WDIO + Appium). Pick the one you need.

### Web Quick Start

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

### Mobile Quick Start (Android)

```bash
# 1. Prerequisites (one-time)
#   — Install Node.js >= 18, Java 17+, Android SDK (SDK Manager or Android Studio)
#   — Install Appium 2.x: npm install -g appium && appium driver install uiautomator2
#   — Start Appium in a terminal: appium
#   — Connect an Android device via USB (or start an emulator) and accept USB debugging
#   — Verify: adb devices   (should list your device)

# 2. Install and initialize (same as web — setup.js copies mobile templates too)
npm install
npm run setup

# 3. Configure mobile credentials in output/.env
cd output
cat >> .env <<'EOF'
PLATFORM=android
ANDROID_DEVICE=<your-adb-serial-from-adb-devices>
APPIUM_HOST=localhost
APPIUM_PORT=4723
NO_RESET=true
# Option A — attach to pre-installed app by package + activity
APP_PACKAGE=org.zwanoo.android.speedtest
APP_ACTIVITY=com.ookla.mobile4.screens.main.MainActivity
# Option B — install a customer-provided APK fresh each session
# APP_PATH=/absolute/path/to/customer-app.apk
EOF

# 4. Reload VS Code window so the Appium MCP server picks up

# 5. Run the Explorer (in Copilot chat) — reads live app via Appium MCP
# @QE Explorer Run Explorer for scenario speedtest-run-test, type mobile.
# Input: scenarios/mobile/speedtest-run-test.md

# 6. Run the Builder (in a new Copilot chat)
# @QE Builder Run Builder for scenario speedtest-run-test, type mobile.
# Input: scenarios/mobile/speedtest-run-test.enriched.md

# 7. Run the test (platform filter is MANDATORY — see Mobile Platform Targeting below)
cd output && PLATFORM=android npx wdio run wdio.conf.ts \
  --spec tests/mobile/speedtest/speedtest-run-test.spec.ts \
  --mochaOpts.grep "@android-only|@cross-platform"
```

iOS Quick Start follows the same shape but requires macOS + Xcode + WebDriverAgent. See [Mobile Test Automation → iOS setup](#ios-setup) below.

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

**Core (all scenario types):**
- **Node.js** >= 18.0.0
- **VS Code** with GitHub Copilot (1.113+) **or** Claude Code CLI

**Web / API / hybrid:**
- **Playwright** >= 1.50.0 (installed by `npm install` via `templates/config/package.json`)
- **MCP Playwright server** for the Explorer's live browser access

**Mobile (Android):**
- **Java JDK** 17 or newer (required by Appium UiAutomator2)
- **Android SDK** with `platform-tools` (for `adb`) — install via Android Studio SDK Manager or standalone `cmdline-tools`
- **`ANDROID_HOME`** environment variable set to your SDK root (e.g. `~/Android/Sdk`)
- **Appium 2.x server** running (`npm install -g appium && appium driver install uiautomator2 && appium`)
- **Android device** (USB-connected with USB debugging enabled) **OR** Android emulator (via Android Studio AVD Manager)
- **MCP Appium server** for the Explorer's live app access (`appium-mcp` package)

**Mobile (iOS):**
- **macOS** (required — Xcode does not run on Linux/Windows)
- **Xcode** 15+ and Xcode Command Line Tools
- **iOS Simulator** (bundled with Xcode) **OR** real iOS device with Apple Developer account
- **WebDriverAgent** (bundled with Appium's XCUITest driver — auto-built on first run but may need code-signing for real devices)
- **Appium 2.x server** with XCUITest driver (`appium driver install xcuitest`)
- **`carthage`** (for WDA dependencies — `brew install carthage`)

### Platform Support

| Platform | Agent Invocation | MCP Servers | Setup |
|----------|-----------------|-------------|-------|
| **Claude Code (CLI)** | `Agent` tool | Playwright MCP + Appium MCP (mobile) | Add to `~/.claude/mcp_servers.json` or `.mcp.json` |
| **VS Code + Copilot** | `@QE Orchestrator` mention | Playwright MCP + Appium MCP (mobile) | Add to `.vscode/mcp.json`, enable `chat.subagents.allowInvocationsFromSubagents`. Template: `.vscode/mcp.example.json` |

### Scenario Type Support

| Type | Status | Runner | Device-verified? |
|---|---|---|---|
| **web** | ✅ Production | Playwright | Yes — SauceDemo, OrangeHRM, Epic SSO |
| **api** | ✅ Production | Playwright request fixture | Yes — JSONPlaceholder CRUD |
| **hybrid** | ✅ Production | Playwright page + request | Yes |
| **mobile** (Android) | ✅ **GA** | WebdriverIO + Appium UiAutomator2 | Yes — Flipkart E2E + 9/9 parity tests |
| **mobile** (iOS) | ⚠️ Supported at the config level, **not yet device-verified** | WebdriverIO + Appium XCUITest | **No** — see [iOS support status](#ios-support-status) |
| **mobile-hybrid** | ✅ Production | WebdriverIO + axios via `browser.call()` | Yes (Android) |

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

### 4. Configure MCP Servers (Explorer live-app access)

The Explorer needs an MCP server to interact with the app under test. **Web/hybrid** uses `@playwright/mcp`. **Mobile/mobile-hybrid** uses `appium-mcp`.

**VS Code** — copy `.vscode/mcp.example.json` to `.vscode/mcp.json` and edit paths if needed. The sanitized example uses generic `npx`:

```json
{
  "servers": {
    "playwright": {
      "command": "npx",
      "args": ["@playwright/mcp@latest", "--isolated", "--browser", "chromium"]
    },
    "appium-mcp": {
      "command": "npx",
      "args": ["-y", "appium-mcp@latest"],
      "env": { "ANDROID_HOME": "${env:ANDROID_HOME}" }
    }
  }
}
```

**If you use nvm, fnm, or volta**, bare `npx` may not resolve from VS Code's MCP host. In that case use the full path returned by `which npx` and set `PATH` explicitly in the server's `env` block. (`npm run setup` will also patch the paths automatically on first run.) After editing, **reload the VS Code window** (`Ctrl+Shift+P` → "Developer: Reload Window") for both MCP servers to start.

For mobile, **also ensure Appium 2.x is running** in a separate terminal before invoking the Explorer:
```bash
# One-time: install Appium + driver
npm install -g appium
appium driver install uiautomator2           # Android
appium driver install xcuitest               # iOS (macOS only)

# Each session: start the server
appium      # runs on http://localhost:4723
```

**Claude Code CLI** — add equivalent entries to `.mcp.json` in project root or `~/.claude/mcp_servers.json`.

`.vscode/mcp.json` is **gitignored** so your local absolute paths and env vars don't leak to source control. The committed template lives at `.vscode/mcp.example.json`.

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

| Type | Runner | Fixture/Context | Page/Screen Objects? | Locators? | Example |
|------|--------|-----------------|:---:|:---:|---------|
| `web` | Playwright | `{ page }` | Yes (pages) | Yes | Login, checkout, form submission |
| `api` | Playwright | `{ request }` | No | No | REST CRUD, schema validation |
| `hybrid` | Playwright | `{ page, request }` | Yes (UI only) | Yes (UI only) | Create via API, verify in UI |
| `mobile` | WDIO + Appium | global `browser` | Yes (screens) | Yes (platform-keyed JSON with `android` / `ios` sub-objects) | Tap, swipe, native gestures, permissions |
| `mobile-hybrid` | WDIO + Appium + axios | global `browser` + `browser.call()` for API | Yes (screens) | Yes | Create via API, verify in native app |

Mobile scenarios use a different keyword-to-code mapping (no `test.step()`, uses `// Step N —` comment markers; no `expect.soft()`, uses `softAssertions[]` + `recordSoftFailure()`; Mocha lifecycle hooks instead of Playwright's). Full reference: [Mobile Test Automation](#mobile-test-automation) below, and [`agents/shared/keyword-reference.md`](agents/shared/keyword-reference.md).

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

#### Hinting Team Helpers in Natural Language

If your team maintains reusable helpers under `output/pages/*.helpers.ts` (web) or `output/screens/*.helpers.ts` (mobile) and you want the Enricher to reference one when converting natural language to a scenario, **mention the helper by name in the description** — the Enricher will pass it through as a `USE_HELPER` step:

> *"Log in as Director, navigate to Exams, then **use the `ExamsPage.calculateSeatingCapacity` helper** and save the result as `seats`. Verify the seat count equals 24."*

The Enricher emits this as:

```
USE_HELPER: ExamsPage.calculateSeatingCapacity -> {{seats}}
```

The Enricher does **not** auto-discover helpers — it won't add `USE_HELPER` unless you explicitly name one. This is deliberate: the Enricher has no file system access to verify helpers exist, and silent auto-insertion would hide implementation details from the scenario author. If you're unsure whether a helper exists, leave it out; the Explorer/Builder will write the interaction inline from the live app. For the full `USE_HELPER` contract (capture syntax, missing-helper warnings, mobile equivalent), see [agents/shared/keyword-reference.md](agents/shared/keyword-reference.md).

#### Cross-Scenario Data Flow — `Produces` and `Depends On` in Natural Language

If one of your scenarios needs to publish a value (order number, user ID, auth token) for another scenario to reuse, say so in plain words — the Enricher will set up `SAVE` + `Produces:` on the writer and `Depends On:` + `{{SHARED.*}}` on the reader.

**Publishing a value (writer side):** use verbs like *save*, *capture for later*, *remember*, *record*, *publish*, *make available to downstream tests*.

> *"...after the order is placed, **save the order number so other tests can use it**."*

becomes

```markdown
- **Produces:** orderNumber (saved to shared-state)

...
N. CAPTURE: order number from confirmation page as {{orderNumber}}
N+1. SAVE: {{orderNumber}} to shared-state as "orderNumber"
```

**Reading a value (reader side):** you **must** refer to the upstream scenario with the word `scenario` after its name. This is a hard rule, not a stylistic preference. Without the suffix, a name like `user-create` or `checkout-flow` is ambiguous — it could be a feature, a page, a class, a helper, a CI job, or a scenario. The `scenario` suffix is the **sole signal** the Enricher uses to recognize a cross-scenario reference.

> ✅ *"...**use the userId from the user-create scenario** and look up that user's profile."*

becomes

```markdown
- **Depends On:** user-create (needs: userId)

...
1. Navigate to {{ENV.BASE_URL}}/users/{{SHARED.userId}}
2. VERIFY: Profile page for the created user is displayed
```

> ❌ *"use the userId from user-create"* — **will not** trigger a `Depends On` declaration. The Enricher will add a `## Notes` entry telling you to restate with `"user-create scenario"` and re-run.

**Preconditions vs. dependencies — don't confuse them.** *"Assume the user is logged in"* is a precondition (a state to set up at the start of the scenario) and does **not** become a `Depends On`. A precondition just adds login steps. A dependency references a **specific value** that a **specific named scenario** saved via `SAVE`.

**Both fields default to `None`.** Most scenarios are self-contained and need neither. If you don't mention publishing or consuming shared state, the Enricher emits `- **Depends On:** None` and `- **Produces:** None` — template-compliant and unambiguous.

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

## Mobile Test Automation

The framework generates native mobile test specs for **Android** (UiAutomator2) and **iOS** (XCUITest) at feature parity with the Playwright pipeline. Mobile scenarios use the same Explorer → Builder → Executor → Reviewer flow, same keyword vocabulary (`VERIFY`, `CAPTURE`, `SCREENSHOT`, `SAVE`, `DATASETS`, `SHARED_DATA`, `USE_HELPER`, `IF`/`REPEAT_UNTIL`/`TRY_ELSE`), and same file ownership rules — but the generated code is **WDIO + Mocha + Appium**, not Playwright.

### iOS Support Status

> **iOS is supported at the config level but has not yet been device-verified.** All 9 mobile parity verification tests and the Flipkart end-to-end regression were run on Android only (device `13161314AG042848`, Appium 3.2.0). The framework's infrastructure — `iosCapabilities`, `MobileLocatorLoader` iOS strategy priority (`accessibility_id → id → class_chain → predicate_string → xpath`), `BaseScreen.goBack()`/`goHome()` iOS branches, platform-keyed locator JSON, XCUITest driver integration — is all in place. You should expect:
> - **WebDriverAgent first-build friction.** Appium's XCUITest driver builds WDA automatically on first run, but real-device testing requires Xcode code-signing with your Apple Developer account. Simulator testing has no signing requirement.
> - **Android-only methods to replace.** `BaseScreen.selectOption()` hardcodes an `android=new UiSelector()...` query — write a screen-specific picker-wheel helper for iOS. `BaseScreen.waitForActivity()` uses Android Activities — replace with a stable-element wait for iOS.
> - **No iOS example scenarios yet.** Use the Android scenarios as structural templates and add `ios:` sub-objects to your locator JSON files.
> - **Contribution welcome.** When you run the framework on iOS for the first time, please contribute your iOS app-context patterns back to `scenarios/app-contexts/{app}-ios.md` so future users benefit.

### Mobile Platform Targeting — `Platform:` Header Convention

The framework uses a **flat directory structure** for mobile (`scenarios/mobile/{folder?}/{scenario}.md`) — there is no `scenarios/mobile/android/` or `scenarios/mobile/ios/` split. The platform dimension is carried by **two things inside the files**:

1. A **mandatory `Platform:` header** in the scenario metadata (`android`, `ios`, or `both`)
2. **Platform-keyed locator JSONs** with `android:` and/or `ios:` sub-objects per element

This means ~90% of scenarios (where Android and iOS share the same flow) are authored once and run on both platforms. Only the locator entries differ, and that difference is captured inside the JSON file — not by duplicating the scenario, the spec, the screen objects, or the test data.

**The three `Platform:` values:**

| Header | When to use | Spec tag emitted by Builder | Runs when |
|---|---|---|---|
| `Platform: android` | Android-only features (Quick Settings tile, back button), or app not yet on iOS, or "Android-first" scenarios | `@android-only` | `PLATFORM=android` |
| `Platform: ios` | iOS-only features (Share Sheet extension, Haptic Touch), or app not yet on Android | `@ios-only` | `PLATFORM=ios` |
| `Platform: both` | Shared flow across Android + iOS (most common case — ~90% of scenarios). **REQUIRES** every locator JSON entry used by the scenario to have both `android:` and `ios:` sub-objects. | `@cross-platform` | Both `PLATFORM=android` AND `PLATFORM=ios` |

**Scenario format:**

```markdown
## Metadata
- **Module:** Flipkart — Shopping Cart
- **Priority:** P1
- **Type:** mobile
- **Platform:** both                   <!-- MANDATORY -->
- **Tags:** mobile, regression, shopping, P1
```

The Builder reads the `Platform:` header and emits the matching tag in the top-level `describe` title:

```typescript
// From Platform: both
describe('Flipkart — Add to Cart Through Checkout @regression @P1 @cross-platform', () => { ... });

// From Platform: android
describe('Android Quick Settings toggle @smoke @P2 @android-only', () => { ... });

// From Platform: ios
describe('iOS Share Sheet extension @regression @P1 @ios-only', () => { ... });
```

**Running mobile tests — MANDATORY platform filter:**

```bash
# Android: runs @android-only + @cross-platform scenarios, skips @ios-only
PLATFORM=android npx wdio run wdio.conf.ts --mochaOpts.grep "@android-only|@cross-platform"

# iOS: runs @ios-only + @cross-platform scenarios, skips @android-only
PLATFORM=ios npx wdio run wdio.conf.ts --mochaOpts.grep "@ios-only|@cross-platform"
```

Without the `--mochaOpts.grep` filter, a `PLATFORM=android` run would attempt to execute iOS-only specs and fail at the locator-lookup stage (no `android:` sub-object in the locator JSON). **The filter is the cheap safety net; the platform tag in the `describe` title is the contract.**

**Why this architecture (vs. `scenarios/mobile/{platform}/` subdirectories)?**

| Concern | Flat structure + `Platform:` header | Platform-first folders |
|---|---|---|
| Shared flows (~90% of scenarios) | Authored once, runs on both platforms | Duplicated — 2× the .md, .spec.ts, .json, screen objects |
| Flow changes (add 1 step) | 1 file edit | 2 file edits + drift risk |
| Test count | N scenarios × 2 platforms = accurate coverage | 2N scenarios, same coverage — wasted effort |
| Platform-specific flows (Share Sheet, Quick Settings) | `Platform: android` or `Platform: ios` header — coexists in the same folder | Sibling directories |
| Platform-owning teams | CODEOWNERS + tag-based CI splitting (`--mochaOpts.grep`) | Directory ownership — blunt instrument |
| Leverages platform-keyed locator architecture | Yes — one locator file, `android:`/`ios:` sub-objects | No — duplicates the platform dimension across files |

**Forbidden patterns:** do NOT create `scenarios/mobile/android/` or `scenarios/mobile/ios/` directory trees. Do NOT duplicate `output/tests/mobile/android/` vs `output/tests/mobile/ios/`. The Enricher, Explorer, and Builder will all refuse to write files into a platform subdirectory under `mobile/`. If you genuinely need platform-specific flow divergence (rare — estimated <10% of scenarios), write two scenarios in the same folder with `Platform: android` and `Platform: ios` headers — they live side by side, not segregated.

Full convention reference: [`agents/shared/keyword-reference.md § Mobile Platform Header`](agents/shared/keyword-reference.md) and [`agents/core/code-generation-rules.md §16.3a`](agents/core/code-generation-rules.md).

### Writing a Mobile Scenario

Same `.md` format as web, but declare `Type: mobile` (or `mobile-hybrid`). Here's the minimal SpeedTest reference scenario:

```markdown
# Scenario: SpeedTest Run

## Metadata
- **Priority:** P2
- **Type:** mobile
- **Platform:** android
- **Tags:** mobile, smoke, P2

## Application
- **App Package (Android):** {{ENV.APP_PACKAGE}}
- **App Activity (Android):** {{ENV.APP_ACTIVITY}}
- **Device:** {{ENV.ANDROID_DEVICE}}

## Pre-conditions
- SpeedTest app installed on device/emulator
- Device connected via ADB (`adb devices` lists it)
- Appium server running on localhost:4723

## Steps
1. Launch the app
2. VERIFY: GO button is displayed
3. Tap the GO button
4. Wait for the speed test to complete (typically 30-45s)
5. VERIFY: Download speed value is greater than 0
6. CAPTURE: Download speed as {{downloadMbps}}
7. CAPTURE: Upload speed as {{uploadMbps}}
8. REPORT: "SpeedTest completed — {{downloadMbps}} down / {{uploadMbps}} up"
9. SCREENSHOT: speedtest-results
```

And a production-app example (Flipkart checkout, 43 steps, device-verified):

```markdown
# Scenario: Flipkart — Add to Cart Through Checkout

## Metadata
- **Priority:** P1
- **Type:** mobile
- **Platform:** android
- **Tags:** mobile, regression, shopping, cart, P1

## Application
- **App Package (Android):** com.flipkart.android
- **App Activity (Android):** com.flipkart.android.SplashActivity
- **Device:** {{ENV.ANDROID_DEVICE}}

## Pre-conditions
- Flipkart app installed
- Logged in as guest (no login required for browsing)
- PopupGuard enabled (promo banners, login prompts, notifications — handled automatically)

## Steps
1. Launch the app
2. Dismiss any permission dialogs (location, notifications)
3. Tap the "Search" icon in the bottom nav
4. Type "LUKZER" in the search box
5. Tap the first search suggestion
6. VERIFY: Search results contain at least one "LUKZER" product
7. Tap the first LUKZER product
8. VERIFY: Product detail screen is displayed
9. Tap "Buy Now"
...
(40+ steps: address selection → order summary → payment page → navigate back → verify cart → remove item → verify empty)
```

Full version lives at [`scenarios/mobile/flipkart-add-to-cart.md`](scenarios/mobile/flipkart-add-to-cart.md).

**Mobile keyword differences** (see [`agents/shared/keyword-reference.md`](agents/shared/keyword-reference.md) for full spec):

| Keyword | Web code | Mobile code |
|---|---|---|
| `VERIFY` | `expect(...)` | `expect(...)` (from `@wdio/globals`) |
| `VERIFY_SOFT` | `expect.soft(...)` + auto-attach screenshot | `try { expect(...) } catch { softAssertions.push(await screen.recordSoftFailure(...)) }` + final conditional throw |
| Step marker | `await test.step('Step N — ...', async () => {...})` | `// Step N — ...` comment (Mocha has no `test.step()`) |
| Lifecycle | `test.beforeAll` / `beforeEach` / `afterEach` / `afterAll` | `before` / `beforeEach` / `afterEach` / `after` (Mocha globals) |
| `SCREENSHOT` | `test.info().attach(...)` | `await screen.takeScreenshot('name')` — saves PNG to `test-results/screenshots/` |
| `REPORT` | `test.info().annotations.push(...)` | `console.log(...)` (WDIO spec reporter + Allure log) |
| `DATASETS` | `for (const data of testData) { test(..., ...) }` | `for (const data of testData) { it(..., ...) }` — MUST be inside `describe()` and OUTSIDE `it()` |
| `USE_HELPER` | `class FooPageWithHelpers extends FooPage {...}` | `applyHelpers(new FooScreen(browser))` |

### Setup — Android

**1. Install prerequisites (one-time):**
```bash
# Java JDK 17+ — required by UiAutomator2
# Ubuntu/Debian:
sudo apt install openjdk-17-jdk
# macOS:
brew install openjdk@17

# Android SDK — install via Android Studio OR standalone cmdline-tools
# After install, set ANDROID_HOME:
echo 'export ANDROID_HOME=$HOME/Android/Sdk' >> ~/.bashrc
echo 'export PATH=$PATH:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator' >> ~/.bashrc
source ~/.bashrc

# Appium 2.x + UiAutomator2 driver
npm install -g appium
appium driver install uiautomator2

# Verify install
appium --version               # should print 2.x
adb --version                  # should print platform-tools
```

**2. Connect a device OR start an emulator:**
```bash
# Real device: enable USB debugging in Developer Options, plug in, accept the RSA fingerprint prompt
adb devices                    # should list your device

# Emulator: via Android Studio AVD Manager, or CLI
~/Android/Sdk/emulator/emulator -avd Pixel_8_API_34 &
adb wait-for-device
adb devices                    # should list emulator-5554
```

**3. Start Appium server (leave running in a dedicated terminal):**
```bash
appium                         # runs on http://localhost:4723
```

**4. Configure `output/.env`:**
```env
PLATFORM=android
APPIUM_HOST=localhost
APPIUM_PORT=4723
ANDROID_DEVICE=emulator-5554               # or your real device serial
NO_RESET=true                              # true = fast attach, false = fresh install per session

# Option A — pre-installed app
APP_PACKAGE=com.example.app
APP_ACTIVITY=com.example.app.MainActivity

# Option B — install fresh APK per session
# APP_PATH=/absolute/path/to/customer-app.apk
```

### Customer-Provided APK + Emulator Flow

Many enterprise teams ship test cycles with a customer-provided APK file and no pre-installed app. Both patterns are supported:

**Pattern A — Install once via ADB, attach by package name (fastest):**
```bash
# Install the APK on the target device or emulator
adb -s emulator-5554 install /path/to/customer-app.apk

# Extract the package + launchable activity from the APK (one-time lookup)
aapt dump badging /path/to/customer-app.apk | grep -E "package|launchable-activity"
# package: name='com.customer.app' ...
# launchable-activity: name='com.customer.app.MainActivity' ...

# Add to output/.env
echo "APP_PACKAGE=com.customer.app" >> output/.env
echo "APP_ACTIVITY=com.customer.app.MainActivity" >> output/.env
echo "NO_RESET=true" >> output/.env      # keep app state between runs (faster iteration)

# Run the test
PLATFORM=android npx wdio run wdio.conf.ts --spec tests/mobile/customer/smoke.spec.ts
```

**Pattern B — Install fresh per session via `APP_PATH` (cleanest state):**
```bash
# Set APP_PATH; Appium installs the APK on every session start
echo "APP_PATH=/absolute/path/to/customer-app.apk" >> output/.env
echo "NO_RESET=false" >> output/.env     # clean state per session

PLATFORM=android npx wdio run wdio.conf.ts --spec tests/mobile/customer/smoke.spec.ts
```

The framework's [`capabilities.ts`](output/core/capabilities.ts) handles both modes automatically:
```typescript
...(process.env.APP_PATH
  ? { 'appium:app': process.env.APP_PATH }
  : {
      'appium:appPackage': process.env.APP_PACKAGE,
      'appium:appActivity': process.env.APP_ACTIVITY,
    }),
```

**Emulator vs real device:** functionally identical to Appium once `adb devices` shows them. The practical differences:
- Emulators are slower for graphics-heavy flows and screen recording
- GBoard glide-typing injection bugs do NOT reproduce on emulator (emulators use a different IME)
- Real devices surface more timing flakiness (network, GC pauses) — catches more bugs
- Use emulators for rapid iteration; use real devices for release gates

<a id="ios-setup"></a>

### Setup — iOS (macOS only, not yet device-verified)

**1. Install prerequisites (one-time):**
```bash
# Xcode + Command Line Tools — from the Mac App Store or developer.apple.com
xcode-select --install

# Carthage — used by WebDriverAgent for dependency building
brew install carthage

# Appium + XCUITest driver
npm install -g appium
appium driver install xcuitest
```

**2. Simulator OR real device:**
```bash
# Simulator — list installed simulators
xcrun simctl list devices available

# Real device — find UDID
xcrun xctrace list devices
# Or: system_profiler SPUSBDataType | grep -A 3 "iPhone"
```

**3. Build & sign WebDriverAgent (real devices only):**
Open `~/.appium/node_modules/appium-xcuitest-driver/node_modules/appium-webdriveragent/WebDriverAgent.xcodeproj` in Xcode. Under "Signing & Capabilities," pick your Apple Developer team for the `WebDriverAgentRunner` target. Build once to install WDA on the device. This is a one-time step per device. Simulator testing skips this entirely.

**4. Start Appium server:**
```bash
appium                         # same server serves both Android and iOS
```

**5. Configure `output/.env`:**
```env
PLATFORM=ios
APPIUM_HOST=localhost
APPIUM_PORT=4723
IOS_DEVICE=iPhone 15           # simulator name OR real device name
IOS_UDID=                      # required for real devices, leave empty for simulator
IOS_VERSION=17.0

# Option A — pre-installed app
IOS_BUNDLE_ID=com.example.app

# Option B — install fresh .app per session
# IOS_APP_PATH=/absolute/path/to/app.app
```

**6. Run tests exactly like Android — the platform switch happens in `capabilities.ts`:**
```bash
PLATFORM=ios npx wdio run wdio.conf.ts --spec tests/mobile/customer/smoke.spec.ts
```

### Running Mobile Tests

> **ALWAYS pass the platform filter.** Every mobile run must include `--mochaOpts.grep "@<platform>-only|@cross-platform"` so the wrong-platform specs are skipped. This is non-negotiable — see [Mobile Platform Targeting](#mobile-platform-targeting--platform-header-convention) above. The examples below show the filter on every command.

**Single spec (Android):**
```bash
PLATFORM=android npx wdio run wdio.conf.ts \
  --spec tests/mobile/flipkart/flipkart-add-to-cart.spec.ts \
  --mochaOpts.grep "@android-only|@cross-platform"
```

**Single spec (iOS):**
```bash
PLATFORM=ios npx wdio run wdio.conf.ts \
  --spec tests/mobile/flipkart/flipkart-add-to-cart.spec.ts \
  --mochaOpts.grep "@ios-only|@cross-platform"
```

**All mobile specs in one command** (the `wdio.conf.ts` `specs` glob already matches `tests/mobile/**/*.spec.ts`):
```bash
# Android — runs @android-only + @cross-platform specs, skips @ios-only
PLATFORM=android npx wdio run wdio.conf.ts --mochaOpts.grep "@android-only|@cross-platform"

# iOS — runs @ios-only + @cross-platform specs, skips @android-only
PLATFORM=ios npx wdio run wdio.conf.ts --mochaOpts.grep "@ios-only|@cross-platform"
```

The `beforeSuite` hook in `wdio.conf.ts` calls `terminateApp` + `activateApp` before every spec file, so 20-30 specs run cleanly back-to-back without device-state contamination (~1s reset per spec vs ~15s for full session restart).

**Combine platform filter with other tags:**
```bash
# Android smoke tests across cross-platform scenarios
PLATFORM=android npx wdio run wdio.conf.ts --mochaOpts.grep "(@android-only|@cross-platform).*@smoke"

# iOS P0 regression
PLATFORM=ios npx wdio run wdio.conf.ts --mochaOpts.grep "(@ios-only|@cross-platform).*@P0"
```

**Run a subtree (still pass the platform filter):**
```bash
PLATFORM=android npx wdio run wdio.conf.ts \
  --spec 'tests/mobile/flipkart/**/*.spec.ts' \
  --mochaOpts.grep "@android-only|@cross-platform"
```

**Fail-fast (for smoke gates):** set `bail: 1` in `wdio.conf.ts`. Default is `0` — failing specs don't stop subsequent ones.

### Multi-Device Parallelism

WDIO uses the `capabilities: [...]` array — one entry per device. **Default behavior is parallel cross-device coverage** (each capability runs the FULL spec list, NOT sharding). For sharded speed-up across N devices, use `--shard X/N` from N parallel CI jobs.

#### Local Lab (multiple ADB-connected devices)

Drive the capabilities array from an env var. The framework's [`capabilities.ts`](output/core/capabilities.ts) returns a single device today; extend it to enumerate `ANDROID_DEVICES` for local labs:

```typescript
// output/core/capabilities.ts — enhanced for local lab
const deviceSerials = (process.env.ANDROID_DEVICES || process.env.ANDROID_DEVICE || '').split(',').filter(Boolean);

export function getAndroidCapabilities() {
  return deviceSerials.map(serial => ({
    platformName: 'Android',
    'appium:automationName': 'UIAutomator2',
    'appium:deviceName': serial,
    'appium:appPackage': process.env.APP_PACKAGE,
    'appium:appActivity': process.env.APP_ACTIVITY,
    'appium:noReset': process.env.NO_RESET === 'true',
  }));
}

// wdio.conf.ts
maxInstances: 3,                        // parallel session cap
capabilities: getAndroidCapabilities(),
```

```bash
ANDROID_DEVICES=R5CT12345,R5CT67890,R5CT99999 PLATFORM=android npx wdio run wdio.conf.ts
```

#### BrowserStack App Automate

Install `@wdio/browserstack-service`, set `BROWSERSTACK_USERNAME` + `BROWSERSTACK_ACCESS_KEY` env vars, list device combinations explicitly:

```typescript
// wdio.conf.ts
export const config = {
  user: process.env.BROWSERSTACK_USERNAME,
  key: process.env.BROWSERSTACK_ACCESS_KEY,
  services: [
    ['browserstack', { app: 'bs://<app-id-from-upload>', browserstackLocal: false }],
  ],
  capabilities: [
    {
      platformName: 'Android',
      'bstack:options': {
        deviceName: 'Google Pixel 8',
        osVersion: '14.0',
        projectName: 'agentic-qe',
        buildName: `mobile-regression-${process.env.BUILD_NUMBER}`,
        sessionName: 'flipkart-checkout',
        appiumVersion: '2.0.1',
      },
    },
    {
      platformName: 'Android',
      'bstack:options': {
        deviceName: 'Samsung Galaxy S23',
        osVersion: '13.0',
        projectName: 'agentic-qe',
        appiumVersion: '2.0.1',
      },
    },
    {
      platformName: 'iOS',
      'xcuitest:options': { deviceName: 'iPhone 15', osVersion: '17.0' },
      'bstack:options': { projectName: 'agentic-qe', appiumVersion: '2.0.1' },
    },
  ],
};
```

Upload the APK once:
```bash
curl -u "$BROWSERSTACK_USERNAME:$BROWSERSTACK_ACCESS_KEY" \
  -X POST "https://api-cloud.browserstack.com/app-automate/upload" \
  -F "file=@app.apk"
# Response: { "app_url": "bs://abc123..." }
```

Paste the returned `bs://...` URL into the `services[0].app` field above.

#### Sauce Labs

Install `@wdio/sauce-service`, set `SAUCE_USERNAME` + `SAUCE_ACCESS_KEY` env vars. Vendor key is `'sauce:options'`, service name is `'sauce'`:

```typescript
services: ['sauce'],
capabilities: [
  {
    platformName: 'Android',
    'appium:app': 'storage:filename=app.apk',   // Sauce storage reference
    'sauce:options': {
      deviceName: 'Google Pixel 8',
      platformVersion: '14.0',
      appiumVersion: '2.0.1',
      build: `mobile-regression-${process.env.BUILD_NUMBER}`,
      name: 'flipkart-checkout',
    },
  },
],
```

Upload the APK via Sauce Storage API:
```bash
curl -u "$SAUCE_USERNAME:$SAUCE_ACCESS_KEY" \
  --location \
  --request POST 'https://api.us-west-1.saucelabs.com/v1/storage/upload' \
  --form 'payload=@"app.apk"' \
  --form 'name="app.apk"'
```

#### LambdaTest

Install `wdio-lambdatest-service` (community package, not `@wdio/`-scoped). Set `LT_USERNAME` + `LT_ACCESS_KEY`. Vendor key is `'lt:options'`:

```typescript
services: ['lambdatest'],
capabilities: [
  {
    platformName: 'Android',
    'appium:app': 'lt://APP10160541716...',     // from LambdaTest app upload
    'lt:options': {
      deviceName: 'Pixel 8',
      platformVersion: '14',
      appiumVersion: '2.0.1',
      project: 'agentic-qe',
      build: `mobile-regression-${process.env.BUILD_NUMBER}`,
      name: 'flipkart-checkout',
    },
  },
],
```

Upload the APK via LambdaTest's App API:
```bash
curl -u "$LT_USERNAME:$LT_ACCESS_KEY" \
  -X POST "https://manual-api.lambdatest.com/app/upload/realDevice" \
  -F "name=app.apk" \
  -F "appFile=@app.apk"
# Response: { "app_url": "lt://APP10160541716..." }
```

**The pattern is identical across all three cloud providers.** Vendor options key, service name, and app reference format differ; everything else (capability list structure, parallelism semantics, sharding via `--shard`, the `beforeSuite` reset hook) is the same.

#### AWS Device Farm

AWS Device Farm uses a **different model** — you don't list devices in `capabilities`. Instead:

1. Package your `output/` directory as a test bundle zip
2. Upload via `aws devicefarm create-upload`
3. Select a **device pool** (a named set of devices managed in the AWS console or via Terraform)
4. Run with `aws devicefarm schedule-run --device-pool-arn <pool>`

Device Farm handles per-device execution, sharding across the pool, retries, and reporting. WDIO doesn't integrate directly with Device Farm; use the `aws devicefarm` CLI or SDK from your CI job. The framework's `wdio.conf.ts` doesn't need any changes — you run the test bundle inside a Device Farm-managed Appium session, and the existing configuration applies.

**The `beforeSuite` reset hook works on every cloud provider** because it operates on the `browser` global, which is the per-session WebDriver client. Whether the session is on `localhost:4723`, BrowserStack, Sauce Labs, LambdaTest, or AWS Device Farm, `terminateApp` + `activateApp` are standard Appium commands that all major clouds support.

### Mobile Anti-Patterns (AP-1 through AP-7)

The Builder enforces seven anti-patterns specific to mobile, documented in [`agents/core/code-generation-rules.md`](agents/core/code-generation-rules.md) §16.8. Quick reference:

| # | Anti-Pattern | Why It's Wrong | Right Answer |
|---|---|---|---|
| **AP-1** | Hardcoding test-specific values in locators (`textContains("LUKZER Electric Height")`) | Breaks for any other product | Structural anchor via XPath sibling lookup |
| **AP-2** | Multi-element text matching | Text spans multiple TextViews, never resolves | Split into two locators using a stable label anchor |
| **AP-3** | Full-tree XPath in wait loops (`driver.$$('//ImageView')`) | Scans entire a11y tree, 20-30s per call on RN apps | Targeted locator via `MobileLocatorLoader` or specific UiSelector |
| **AP-4** | Contradictory flow steps (`searchFor(q)` + `tapSuggestion()`) | Submits then tries to tap a gone element | Pick one path and document why |
| **AP-5** | Assuming WebView without verification | Native screen with pointless `switchContext` code | Default to native; only use WebView when Explorer documents `WEBVIEW_*` context exists |
| **AP-6** | No keyboard dismissal after text input | GBoard glide-types into field during swipe | Use `BaseScreen.typeText()` / `pressSequentially()` (auto-dismiss) |
| **AP-7** | Missing React Native performance settings | Every query waits 10s for app idle | Apply `waitForIdleTimeout: 0` in `wdio.conf.ts` `before()` hook (already in template) |

### Mobile Failure Signatures

When a mobile test fails, the Executor matches the failure against 10 diagnostic signatures before escalating. Documented in [`agents/core/executor.md`](agents/core/executor.md) §7. The [`scripts/failure-classifier.js`](scripts/failure-classifier.js) script emits machine-readable category hints that map 1:1 to these signatures:

| Symptom | Category | Deterministic Fix |
|---|---|---|
| Text in EditText grew between scroll cycles (`"by"` → `"by by"`) | `GLIDE_TYPING_INJECTION` | `hideKeyboard()` after text input |
| Locator text > any single TextView's text | `MULTI_ELEMENT_TEXT_MATCH` | Split into two locators with structural anchor |
| Element visible in screenshot but not in page source | `COMPOSE_NO_ACCESSIBILITY_NODE` | `appium_tap_by_coordinates` with `// FRAGILE:` comment |
| Code switches to WEBVIEW but screen is native | `WEBVIEW_VS_NATIVE_MISMATCH` | Remove `getContexts()` / `switchContext()`, use native locators |
| Queries take >15s each | `UIAUTOMATOR_IDLE_TIMEOUT` | Apply `waitForIdleTimeout: 0` in `before()` hook |
| Element not tappable because keyboard covers it | `KEYBOARD_BLOCKING` | `hideKeyboard()` before next interaction |
| App in unexpected state at session start | `STALE_NAVIGATION_STACK` | Add force-stop + relaunch in `before()` hook |
| `getCurrentActivity` returns previous Activity name | (timing race) | Use `BaseScreen.waitForActivity(name, timeoutMs)` |

### Auto-Evidence on Failure

`wdio.conf.ts` `afterTest` hook automatically captures evidence on every failure:

| Artifact | Path | Notes |
|---|---|---|
| **Screenshot** | `test-results/screenshots/FAILED-{test}-{timestamp}.png` | Captures current device screen at failure point |
| **Page source XML** | `test-results/page-sources/FAILED-{test}-{timestamp}.xml` | Full Appium page source — use to diagnose missing elements |
| **Screen recording** | `test-results/videos/FAILED-{test}-{timestamp}.mp4` | Kept only on failure (successful test recordings are discarded) |
| **Allure report** | `allure-results/` → `npm run report:allure:mobile` | Attaches all three artifacts to the failing test step |

No manual instrumentation required — works for every spec automatically as long as `wdio.conf.ts` hasn't been customized away from the template.

### Mobile Example Scenarios

The repository includes two device-verified mobile scenarios:

- [`scenarios/mobile/speedtest-run-test.md`](scenarios/mobile/speedtest-run-test.md) + [`output/tests/mobile/speedtest/`](output/tests/mobile/speedtest/) — SpeedTest by Ookla. Minimal reference scenario (launch app, tap GO button, wait for results, capture download/upload speeds). Good smoke test.
- [`scenarios/mobile/flipkart-add-to-cart.md`](scenarios/mobile/flipkart-add-to-cart.md) + [`output/tests/mobile/flipkart/flipkart-add-to-cart.spec.ts`](output/tests/mobile/flipkart/flipkart-add-to-cart.spec.ts) — Flipkart mobile app, 43-step E2E (search → product detail → Buy Now → address → order summary → payment → cart verify → remove item). Production-app reference that exercises PopupGuard, React Native idle timeout fix, rotating banners, permission dialogs, and the full keyword suite.

Plus four framework verification specs in [`output/tests/mobile/parity/`](output/tests/mobile/parity/) covering lifecycle hooks, VERIFY_SOFT, DATASETS, and SHARED_DATA + saveState. Run them to validate your mobile setup end-to-end.

---

## Onboarding Guides

New team members setting up the framework for the first time should start here. The guides walk through **platform-specific setup** (installing SDKs, connecting devices or cloud accounts, configuring authentication, running a first verification test). They assume you've already completed the core framework install (`git clone` + `npm install` + `npm run setup`) covered in [Setup](#setup) above — each guide picks up from there.

> **📘 Windows users:** the Android and cloud-farm onboarding guides use Unix-style shell syntax (`export FOO=bar`, heredocs, `&` backgrounding). The easiest way to follow them on Windows is to run the commands inside **WSL 2** (Windows Subsystem for Linux) or **Git Bash** (bundled with [Git for Windows](https://git-scm.com/download/win)) — in both, every Unix example works as-written. **Native PowerShell** users will find inline `# PowerShell equivalent:` translations for the 5-10 critical commands in each guide (env var exports, heredoc file creation, background processes, `chmod`). Framework commands (`npm`, `npx wdio`, `adb`, `appium`, `aws`) work identically in PowerShell with no changes. **iOS guides are macOS-only** — Xcode and WebDriverAgent require macOS hardware; if you're on Windows or Linux and need iOS coverage, use [cloud-farms.md](docs/onboarding/cloud-farms.md) or [aws-device-farm.md](docs/onboarding/aws-device-farm.md).

Detailed guides live in [`docs/onboarding/`](docs/onboarding/) so this README stays focused. Pick the guide that matches your test target:

| Target | Guide | Prerequisites | Difficulty | Typical setup time |
|---|---|---|---|---|
| **Android emulator** on your dev laptop | [docs/onboarding/android-emulator.md](docs/onboarding/android-emulator.md) | Android Studio or standalone `cmdline-tools`, hardware virtualization enabled | ⭐ Easy | 30-60 min |
| **Real Android device** via USB | [docs/onboarding/android-device.md](docs/onboarding/android-device.md) | USB cable, developer options enabled on device, OEM USB drivers (Windows) | ⭐ Easy | 20-40 min |
| **iOS Simulator** on macOS | [docs/onboarding/ios-simulator.md](docs/onboarding/ios-simulator.md) | macOS + Xcode + Command Line Tools + Carthage | ⭐⭐ Medium | 60-90 min |
| **Real iOS device** | [docs/onboarding/ios-device.md](docs/onboarding/ios-device.md) | macOS + Xcode + Apple Developer Program membership + device provisioning profiles | ⭐⭐⭐⭐ Hard — **not yet device-verified on this framework** | 2-4 hours first time |
| **BrowserStack, Sauce Labs, or LambdaTest** cloud | [docs/onboarding/cloud-farms.md](docs/onboarding/cloud-farms.md) | Cloud account + credentials, app uploaded via vendor API | ⭐⭐ Medium | 45-90 min |
| **AWS Device Farm** | [docs/onboarding/aws-device-farm.md](docs/onboarding/aws-device-farm.md) | AWS account, IAM credentials, awscli, test bundle packaging | ⭐⭐⭐ Medium-Hard (different execution model) | 60-120 min |

**Decision tree for common scenarios:**

- **"I just want to get the framework running with no physical hardware"** → [android-emulator.md](docs/onboarding/android-emulator.md) (fastest path)
- **"I need to test on a real Android device my team provides"** → [android-device.md](docs/onboarding/android-device.md)
- **"I'm on a Mac and want cross-platform Android + iOS testing"** → [android-emulator.md](docs/onboarding/android-emulator.md) + [ios-simulator.md](docs/onboarding/ios-simulator.md)
- **"CI/CD pipeline with real devices but no physical device lab"** → [cloud-farms.md](docs/onboarding/cloud-farms.md)
- **"Enterprise AWS environment with an approved device pool"** → [aws-device-farm.md](docs/onboarding/aws-device-farm.md)

**iOS status reminder:** the framework supports iOS at the config level but **has not yet been device-verified** as of the current release. The [ios-simulator.md](docs/onboarding/ios-simulator.md) guide is written from Apple + Appium documentation and should be reliable. The [ios-device.md](docs/onboarding/ios-device.md) guide is mostly placeholder material with clear warnings — treat it as a starting point and contribute your fixes back when you complete a successful real-iOS run. See [iOS Support Status](#ios-support-status) for the full disclosure.

**Where onboarding guides stop and the main README takes over:** once you have a working setup (emulator or device recognized by Appium, parity verification spec passing green), come back to [Mobile Test Automation](#mobile-test-automation) for material on writing real scenarios, anti-patterns, failure signatures, and cloud CI integration.

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
- **Mobile** — WDIO + Appium (UiAutomator2 for Android, XCUITest for iOS). Full parity with the Playwright pipeline: BaseScreen with 15 reusable methods, platform-keyed locators, lifecycle hooks, `VERIFY_SOFT`/`DATASETS`/`SHARED_DATA`/`USE_HELPER`, auto-evidence on failure, multi-device cloud integration. Android device-verified; iOS supported at the config level ([status](#ios-support-status)).
- **Mobile-hybrid** — Native mobile + REST API calls (via `browser.call()` wrapping axios). For "create via API, verify in the app" flows.

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

### Browser + Mobile App Exploration

**Web / hybrid (Playwright MCP):**
- **Snapshot-first capture** — derives selectors from the MCP accessibility snapshot (role, name, href). DOM probe fallback for non-accessible elements (SVGs, DOM-only panels, custom widgets).
- **Selector validation gate** — every non-structural selector is validated against the live DOM (`querySelectorAll` count === 1) before recording. Prevents ambiguous selectors that match multiple elements.
- **FAST-walk** — execute interactions for state without deep verification (incremental mode)
- **Bug detection** — 3-question decision gate classifies failures as test issue vs app bug
- **Iframe-aware** — validation runs in the same frame context as the interaction. Shadow DOM elements skip CSS validation and rely on MCP interaction success as proof.

**Mobile (Appium MCP):**
- **Platform-aware locator capture** — Explorer emits platform-keyed JSON (`android: {...}, ios: {...}`) with strategy priority `accessibility_id → id → uiautomator/class_chain → xpath`
- **Page source XML parsing** — one source fetch per verification round, in-memory pattern matching (13+ popup checks in ~1s vs 4+ minutes with naive per-pattern queries)
- **Runtime observations** — Explorer MUST record native-vs-WebView context, keyboard visibility after typing, multi-element text spans, rotating content, React Native detection, chosen flow paths, and Compose/Canvas elements (see [`agents/core/explorer.md`](agents/core/explorer.md) §10)
- **Locator genericization** — Builder enforces 3-level locator quality (bans hardcoded test-specific values via AP-1 anti-pattern). See [`agents/core/builder.md`](agents/core/builder.md) §8
- **Failure signatures** — Executor matches mobile-specific symptoms (GBoard glide typing, multi-element text, UiAutomator idle timeouts, Compose Canvas elements, WebView mismatch, keyboard blocking, stale navigation stack) to deterministic fixes. See [`agents/core/executor.md`](agents/core/executor.md) §7

### Automation Scripts (Zero LLM Tokens)

| Script | Command | Purpose | Mobile support? |
|--------|---------|---------|:---:|
| Scenario diff | `node scripts/scenario-diff.js --scenario=path` | Section-aware diff + change classification (auto-detects enriched.md, falls back to spec) | ✅ |
| Builder incremental | `node scripts/builder-incremental.js --scenario=X --type=web` | Annotate enriched.md, produce builder-instructions.json | ✅ |
| Cleanup annotations | `node scripts/cleanup-annotations.js --file=path` | Strip markers, remove deleted steps, renumber | ✅ |
| Explorer post-check | `node scripts/explorer-post-check.js --scenario=X --type=mobile --folder=flipkart` | Mechanical verification: step counts, locator counts, platform-keyed format check | ✅ `--type=mobile` branches on flat scenario paths + foldered spec paths |
| Review precheck | `node scripts/review-precheck.js --scenario=X --type=mobile --folder=flipkart` | Evidence collection for all 9 Reviewer dimensions | ✅ all dim collectors branched; reads `wdio.conf.ts` for Dim 4 |
| Test results parser | `node scripts/test-results-parser.js --json-path=output/test-results/mobile-results.json` | Structured failure data; auto-detects WDIO vs Playwright JSON shape | ✅ `--runner=wdio` override or auto-detect |
| Failure classifier | `node scripts/failure-classifier.js --results=path` | Classify failures; 7 mobile-specific categories (GLIDE_TYPING_INJECTION, MULTI_ELEMENT_TEXT_MATCH, COMPOSE_NO_A11Y, WEBVIEW_VS_NATIVE, UIAUTOMATOR_IDLE, KEYBOARD_BLOCKING, STALE_NAV) with deterministic fix recommendations | ✅ |
| Swagger parser | `node scripts/swagger-parser.js --spec=path` | Parse OpenAPI specs into scenario templates | — (API only) |
| Metrics collector | `node scripts/metrics-collector.js --run-type=pipeline` | Aggregate observability data across all stages | ✅ |

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
    "web": "my-app.md",
    "api": "",
    "mobile": {
      "android": "my-app-android.md",
      "ios": ""
    }
  },
  "mobile": {
    "appiumHost": "localhost",
    "appiumPort": 4723,
    "defaultPlatform": "android",
    "testTimeoutMs": 240000,
    "actionTimeoutMs": 45000,
    "commandTimeoutMs": 60000
  }
}
```

#### `appContext` — Per-Type Application Context Files

The framework's **recommended model is ONE REPO PER APPLICATION**: a team owns one app that may have web + mobile + API sides, and all three coexist in a single repo. The `appContext` block is keyed by scenario type so each type resolves the right learned-pattern file.

| Key | Used by | Purpose | Empty means |
|---|---|---|---|
| `appContext.web` | `web` scenarios + the UI half of `hybrid` scenarios | Captures web-specific patterns: UI framework (MUI, Fluent, PCF), SSO, known popups, slow components | No web app-context for this repo — skip the load cleanly |
| `appContext.api` | `api` scenarios + optionally merged into `hybrid` / `mobile-hybrid` | Captures API-specific patterns: non-standard auth flows, pagination idioms, error-code quirks. Often empty. | No API app-context — proceed without |
| `appContext.mobile.android` | `mobile` Android runs + the native half of `mobile-hybrid` Android runs | Captures Android-specific patterns: Compose vs native view bias, UiAutomator2 quirks, permission dialogs, React Native idle-timeout needs | No Android app-context — skip |
| `appContext.mobile.ios` | `mobile` iOS runs + the native half of `mobile-hybrid` iOS runs | Captures iOS-specific patterns: XCUITest quirks, ATT prompts, SwiftUI Canvas elements, haptic gestures | No iOS app-context — skip (expected before first iOS run) |

**Resolution rules the agents follow:**

| Scenario type | Resolved path |
|---|---|
| `type: web` | `appContext.web` |
| `type: api` | `appContext.api` |
| `type: hybrid` | `appContext.web` (primary) + optionally `appContext.api` (merged for API-step patterns) |
| `type: mobile` | `appContext.mobile.{android\|ios}` — picked at runtime by the `PLATFORM` env var |
| `type: mobile-hybrid` | `appContext.mobile.{android\|ios}` (primary) + optionally `appContext.api` (merged) |

**For `Platform: both` mobile scenarios:** each run (`PLATFORM=android` or `PLATFORM=ios`) loads its own platform's app-context file. One scenario, two runs, two different context files — that's by design because Android and iOS often have divergent UI frameworks and permission flows.

**Onboarding a new app** = editing this block + creating the file(s) under `scenarios/app-contexts/`. Agents will NEVER create app-context files unprompted — they only append to files whose filenames are already configured. This is the single place that says "this repo is now testing Acme" (or Flipkart, or UAT Scout). The rule is deliberate: it prevents agents from guessing filenames from URLs or scenario names and silently loading the wrong context file.

**Legacy note:** earlier framework releases used a flat `appContext.filename` key. That shape is **no longer read** — if you're migrating from an older config, move the filename under the slot matching your primary scenario type (`appContext.web`, `appContext.mobile.android`, etc.).

#### `mobile` block — Appium connection + mobile timeouts

The `mobile` block controls Appium connection + mobile-specific timeouts. `defaultPlatform` is used when a scenario says `Platform: both` — the framework picks this value for the first pass. Mobile timeouts are deliberately higher than web because real-device interactions (screenshot, page source, W3C gestures) are slower than browser DOM calls.

### `output/playwright.config.ts` — Web / API / Hybrid Test Runner

Standard Playwright configuration. Generated by `setup.js` from `templates/config/playwright.config.ts`. Controls:
- Browser (Chromium default), viewport (1920x1080)
- Reporters (list, JSON, HTML)
- Screenshots, video, trace on failure
- Timeout values (read from `framework-config.json`)

### `output/wdio.conf.ts` — Mobile Test Runner (WDIO + Appium)

Generated by `setup.js` from `templates/config-mobile/wdio.conf.ts`. Controls:
- Appium connection (`hostname`, `port`, auth from env vars)
- Device capabilities via `./core/capabilities.ts` (Android `UiAutomator2`, iOS `XCUITest`)
- Mocha framework (`timeout: 600000`, no retries by default)
- Reporters: `spec` (console), `json` (machine-readable at `test-results/mobile-results.json`), `allure`
- **`before()` hook** — applies UiAutomator2 performance settings (`waitForIdleTimeout: 0`, `ignoreUnimportantViews: true`, etc.) — critical for React Native apps where queries would otherwise take 20-30s each
- **`beforeSuite()` hook** — terminates and re-activates the app under test before every spec file. Required for multi-spec runs with `NO_RESET=true` — without this, state from spec N leaks into spec N+1. ~1s per spec on a real device.
- **`beforeTest()` hook** — starts Appium screen recording per test
- **`afterTest()` hook** — stops recording; **on failure only**, saves screenshot + XML page source + video to `test-results/{screenshots,page-sources,videos}/FAILED-{test}-{timestamp}.{ext}`. Successful test recordings are discarded to keep disk usage bounded.

### `.env` — Credentials, URLs, Mobile Config

All credentials use `process.env.*` — never hardcoded in generated code. Mobile-specific env vars:

```env
# --- Mobile (Appium) -----------------------------------------------------
PLATFORM=android                       # or 'ios'
APPIUM_HOST=localhost
APPIUM_PORT=4723
NO_RESET=true                          # true = fast (attach), false = fresh install each session

# Android
ANDROID_DEVICE=<adb-serial-or-emulator-name>   # from `adb devices`
APP_PACKAGE=com.example.app                    # mutually exclusive with APP_PATH
APP_ACTIVITY=com.example.app.MainActivity      # pair with APP_PACKAGE
# APP_PATH=/absolute/path/to/customer.apk      # alternative: install fresh APK each session

# iOS (macOS only)
IOS_DEVICE=iPhone 15                           # simulator name or device name
IOS_UDID=<udid>                                # required for real devices
IOS_VERSION=17.0
IOS_BUNDLE_ID=com.example.app                  # mutually exclusive with IOS_APP_PATH
# IOS_APP_PATH=/absolute/path/to/app.app       # alternative: install fresh .app each session
```

#### Per-Environment `.env` Files (dev / qa / stg / preprd / prd)

The framework supports a single `.env` by default, plus an optional per-environment pattern for teams that run the same suite against multiple deployments. Pick the pattern that fits your team — both are supported out of the box.

**Pattern A — single `.env` (default).** Edit `output/.env` for whichever environment you happen to be testing. Simple, zero config, works for teams that run against one environment at a time.

**Pattern B — per-environment files.** Create one file per target environment, all sitting next to each other in `output/`:

```
output/
├── .env          ← default / local dev (gitignored)
├── .env.qa       ← QA environment (gitignored)
├── .env.stg      ← Staging (gitignored)
├── .env.preprd   ← Pre-prod (gitignored)
└── .env.prd      ← Production smoke (gitignored)
```

Each file contains the same keys (`BASE_URL`, `TEST_USERNAME`, etc.) but with environment-specific values. The framework ships with `.env.qa` and `.env.stg` as starter copies you can edit — they are gitignored, so your real values never leak.

**Select the environment at run time** via the `TEST_ENV` variable:

```bash
# Linux / macOS
TEST_ENV=qa npx playwright test
TEST_ENV=stg npx playwright test

# Windows PowerShell
$env:TEST_ENV='qa'; npx playwright test

# Windows cmd
set TEST_ENV=qa && npx playwright test
```

No `TEST_ENV` means `output/.env` is loaded (Pattern A stays the default). `TEST_ENV=qa` loads `output/.env.qa` instead, `TEST_ENV=stg` loads `output/.env.stg`, and so on. The loader lives in [output/playwright.config.ts](output/playwright.config.ts) — it reads `process.env.TEST_ENV` and hands the resolved path to `dotenv.config()`.

**Adding a new environment** (e.g. `preprd`):

1. `cp output/.env output/.env.preprd` — start from the default file
2. Edit `output/.env.preprd` with pre-prod URLs, credentials, and any env-specific flags
3. Run with `TEST_ENV=preprd npx playwright test`

No code changes needed — the loader already understands any suffix you pass via `TEST_ENV`.

#### Secrets Management — Vault / CI Secret Store

The `.env` / `.env.*` files are gitignored precisely because they typically contain passwords, API tokens, BrowserStack keys, and similar secrets. For anything beyond a single developer's laptop, secrets should live in a dedicated store, not on disk. Two patterns that work well with this framework:

**Option 1 — Split config from secrets (recommended for most teams).**

Put *non-secret* per-environment values (URLs, feature flags, timeouts) in files you can version-control as documentation — e.g. `output/.env.qa.example` — and keep actual secrets (`TEST_PASSWORD`, `API_TOKEN`, `BROWSERSTACK_ACCESS_KEY`) out of every committed file. At run time, your CI job injects the secrets as real environment variables, and the non-secret file fills in the rest:

```bash
# In the CI job (e.g. GitHub Actions, GitLab CI, Jenkins)
export TEST_PASSWORD="$(vault read -field=password secret/qe/qa)"
export BROWSERSTACK_ACCESS_KEY="$BS_KEY_FROM_CI_SECRET_STORE"
TEST_ENV=qa npx playwright test
```

`process.env.*` always wins over `.env.*` files in Node.js when both exist, so secrets injected by the CI runner override anything in the file. This lets you commit `.env.qa.example` as living documentation of what keys exist, without ever committing values.

**Option 2 — Secrets pulled from a vault at job start.**

For teams already running HashiCorp Vault, AWS Secrets Manager, Azure Key Vault, or GCP Secret Manager, have the CI job fetch secrets at the start and write them into a short-lived `.env.{env}` file that is deleted at job end:

```yaml
# GitHub Actions example
- name: Fetch QA secrets from Vault
  run: |
    vault read -format=json secret/qe/qa \
      | jq -r '.data | to_entries[] | "\(.key)=\(.value)"' \
      > output/.env.qa
- name: Run tests
  run: TEST_ENV=qa npx playwright test
- name: Shred secrets file
  if: always()
  run: rm -f output/.env.qa
```

The file exists only for the duration of the job, lives only inside the CI runner's workspace, and is shredded unconditionally at the end. The repo never sees it.

**CI secret store equivalents for common platforms:**

| Platform | Where secrets live | How to inject |
|---|---|---|
| **GitHub Actions** | Repository → Settings → Secrets and variables → Actions | `env: TEST_PASSWORD: ${{ secrets.QA_TEST_PASSWORD }}` at step level |
| **GitLab CI** | Project → Settings → CI/CD → Variables (masked + protected) | Automatically exposed as env vars in every job |
| **Jenkins** | Credentials plugin → Secret text / Username with password | `withCredentials([string(...)]) { sh 'npx playwright test' }` |
| **Azure DevOps** | Pipeline → Variables → mark as "keep secret" | `$(SECRET_NAME)` interpolation in tasks |
| **CircleCI** | Project Settings → Environment Variables | Automatically exposed as env vars |

**Hard rules for secrets — regardless of platform:**

1. **Never commit a `.env.*` file that contains real secrets.** The `.gitignore` already excludes them, but double-check before any commit touching env files: `git check-ignore -v output/.env.prd` should say the file is ignored.
2. **Rotate any secret that accidentally lands in git history.** Removing the file in a later commit is not enough — treat it as compromised and issue a new credential.
3. **Separate per-environment secrets.** A prod token should never be reachable from a QA run. Use distinct vault paths (`secret/qe/qa`, `secret/qe/prd`) with distinct IAM policies.
4. **Least privilege for CI.** The QA pipeline's vault token should only be able to read QA secrets, not prod ones.

---

## File Ownership

Strict boundaries prevent agents from stepping on each other's work or modifying user-owned files:

| Files | Owner | Agent Access |
|-------|-------|-------------|
| `scenarios/**/*.md` | User/Tester | **Read only** — agents never modify scenario files |
| `scenarios/**/*.enriched.md` | Explorer (first run), then User | Explorer creates once. User can edit. Incremental pipeline annotates temporarily. |
| `output/pages/*.helpers.ts` | Team | **Read only** — agents never create, modify, or delete helper files (web) |
| `output/screens/*.helpers.ts` | Team | **Read only** — mobile equivalent; agents never create, modify, or delete helper files |
| `output/test-data/shared/` | Team | **Read only** — immutable cross-scenario test data |
| `output/core/*` | Framework (`setup.js` from `templates/core/` + `templates/core-mobile/`) | **Read only** — base utilities |
| `output/wdio.conf.ts`, `output/playwright.config.ts` | Framework (`setup.js` from `templates/config-mobile/` + `templates/config/`) | **Read only** — regenerable from templates |
| `output/pages/*.ts` (web) | Builder | Create/modify (agents own these) |
| `output/screens/*.ts` (mobile) | Builder | Create/modify — mobile screen objects extending `BaseScreen` |
| `output/locators/*.json` (web) | Builder + Executor | Builder creates from Explorer's ELEMENT annotations, Executor refines selectors |
| `output/locators/mobile/*.locators.json` | Builder + Executor | Platform-keyed format (`android:` / `ios:`), strategy fallbacks |
| `output/tests/web/**/*.spec.ts`, `output/tests/api/**/*.spec.ts`, `output/tests/hybrid/**/*.spec.ts` | Builder | Create/modify (agents own these) |
| `output/tests/mobile/**/*.spec.ts` | Builder | Create/modify — WDIO/Mocha specs |
| `output/test-data/{web,api,hybrid,mobile}/*.json` | Builder | Create/modify |
| `scenarios/app-contexts/*.md` | Explorer | Read/write — self-improving patterns. Mobile may have a separate `{app}-ios.md` / `{app}-android.md` per platform if behavior diverges. |
| `templates/core-mobile/*`, `templates/config-mobile/*` | Framework maintainer | **Source of truth** for mobile runtime. `setup.js` copies these to `output/` on every setup. To change runtime behavior, edit the template and re-run `npm run setup`. |

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
| App-context file not found by Executor or Explorer | Agents guessing the filename from URL/domain instead of reading config, OR the config slot for the scenario's type is empty | Set the right slot in `framework-config.json → appContext` for the scenario's type: `appContext.web`, `appContext.api`, or `appContext.mobile.{android\|ios}`. Agents resolve the filename by type, not by scenario name. |
| **Mobile:** Explorer says "Appium MCP not available" | Appium MCP server not started OR Appium 2.x server not running on localhost:4723 | Start `appium` in a separate terminal. Verify with `curl http://localhost:4723/status`. Check `.vscode/mcp.json` has the `appium-mcp` server entry. Reload VS Code window. |
| **Mobile:** `adb devices` shows "unauthorized" | Device's RSA fingerprint not accepted yet | Unlock the device, unplug/replug the USB cable, accept the "Allow USB debugging?" prompt on the device screen. |
| **Mobile:** Every element lookup takes 20-30 seconds | React Native app without `waitForIdleTimeout: 0` | The template `wdio.conf.ts` `before()` hook applies this automatically. If you customized wdio.conf.ts, restore the `updateSettings` call from `templates/config-mobile/wdio.conf.ts`. |
| **Mobile:** Multi-spec run fails on the second spec with "element not found" | `NO_RESET=true` + missing `beforeSuite` hook → app state leaks between specs | The template `wdio.conf.ts` `beforeSuite` hook calls `terminateApp` + `activateApp` — ensure it's present. If you removed it, re-run `npm run setup` to restore the template. |
| **Mobile:** Test types "by by by" into the search field during a swipe | GBoard glide typing injection during keyboard-visible swipe | Use `BaseScreen.typeText()` / `pressSequentially()` — they auto-dismiss the keyboard. Or add an explicit `await driver.hideKeyboard()` before the swipe. |
| **Mobile:** Element visible in screenshot but `element not found` | Compose / SwiftUI / Flutter Canvas element — not in the a11y tree | Use `appium_tap_by_coordinates` with a `// FRAGILE: Compose element` comment. The Explorer should have flagged this during capture. |
| **Mobile:** Test passes locally but fails on CI | Device in stale navigation state from previous run | Ensure `beforeSuite` is active (see above). If persistent, add `adb shell am force-stop $APP_PACKAGE` to your CI setup before each test job. |
| **Mobile (iOS):** First run hangs at "Building WebDriverAgent" | Xcode code-signing not configured | Open `~/.appium/node_modules/appium-xcuitest-driver/node_modules/appium-webdriveragent/WebDriverAgent.xcodeproj` in Xcode, sign the `WebDriverAgentRunner` target with your Apple Developer team, build once. Simulator testing doesn't need signing. |
| **Mobile (iOS):** `BaseScreen.selectOption()` fails with "UiSelector not found" | `selectOption()` is Android-only (hardcoded `android=new UiSelector()...`) | Write a screen-specific picker-wheel helper for iOS. See [Mobile Test Automation → iOS Support Status](#ios-support-status). |

---

## Limitations

| Area | Limitation | Workaround |
|------|-----------|------------|
| **Element capture (web)** | Snapshot-first capture covers ~85% of elements. Non-accessible elements (SVGs, DOM-only panels, shadow DOM) require DOM probe fallback. Closed shadow DOM elements skip CSS validation entirely. | DOM probe automatically kicks in for elements not in the accessibility snapshot. Shadow DOM elements rely on MCP interaction success as validation. |
| **Canvas / pixel-based (web)** | Cannot assert on canvas charts or pixel colors. Only SVG/DOM-rendered charts are readable. | Use SVG-based chart libraries, or add `data-testid` attributes to chart containers. |
| **Mobile — iOS** | Framework infrastructure (capabilities, locator loader, BaseScreen gestures, platform-keyed JSON) supports iOS, but **not yet device-verified** (only Android is GA today). Some `BaseScreen` methods (`selectOption`, `waitForActivity`) are Android-only and need screen-specific replacements on iOS. See [iOS Support Status](#ios-support-status). | Write iOS-specific helpers at the screen-object layer. Contribute working iOS app-context patterns back to `scenarios/app-contexts/{app}-ios.md`. |
| **Mobile — Canvas / Compose** | Compose-rendered elements (Android Jetpack Compose, iOS SwiftUI, Flutter) often render as Canvas with no accessibility nodes. | Framework detects this (via Explorer runtime observation) and falls back to `appium_tap_by_coordinates` with a `// FRAGILE:` comment marking the fragility. |
| **Mobile — WebView context switching** | Mixed native + WebView apps need explicit context switching; framework defaults to native-only. | When Explorer observes WEBVIEW contexts via `appium_context`, it records them in enriched.md and the Builder generates `switchContext()` code. |
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
│   ├── mobile/                   # Mobile test scenarios (Android + iOS)
│   │   ├── _template.md          # Mobile scenario template
│   │   ├── _template-hybrid.md   # Mobile-hybrid scenario template
│   │   ├── flipkart-add-to-cart.md  # Reference: 43-step Flipkart E2E
│   │   ├── speedtest-run-test.md    # Reference: minimal SpeedTest scenario
│   │   └── test-{lifecycle-hooks,verify-soft,datasets,shared-data}.md  # Framework parity verification
│   └── app-contexts/             # Learned application patterns (per-app + per-platform)
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
├── templates/                    # Config and core file templates (source of truth)
│   ├── config/                   # TypeScript project template (web + mobile deps)
│   ├── config-javascript/        # JavaScript variant
│   ├── config-python/             # Python variant
│   ├── config-mobile/            # Mobile runner config (wdio.conf.ts, capabilities.ts)
│   ├── core/                     # Core utilities (TypeScript — web runtime)
│   ├── core-mobile/              # Core utilities (TypeScript — mobile runtime: BaseScreen, MobileLocatorLoader, PopupGuard)
│   └── core-python/              # Core utilities (Python)
├── ci/                           # CI/CD configuration
│   ├── config/ci-defaults.json   # Test suite definitions
│   ├── scripts/ci-test-runner.js # CI test runner
│   └── integrations/             # Jira, ServiceNow connectors
├── output/                       # Generated Playwright + WDIO test project
│   ├── core/                     # Runtime utilities (from templates/core/ + templates/core-mobile/)
│   ├── pages/                    # Generated page objects (web)
│   ├── screens/                  # Generated screen objects (mobile, extend BaseScreen)
│   ├── locators/                 # Element selectors (web + mobile/ subdir with platform-keyed JSON)
│   ├── tests/                    # Generated spec files (web/api/hybrid/mobile subdirs)
│   ├── test-data/                # Test data (per-scenario + shared)
│   ├── playwright.config.ts      # Web test runner (from templates/config/)
│   ├── wdio.conf.ts              # Mobile test runner (from templates/config-mobile/)
│   └── reports/                  # Pipeline reports and metrics
├── framework-config.json         # User-configurable agent settings
├── CLAUDE.md                     # Claude Code framework instructions
└── .github/copilot-instructions.md  # Copilot framework instructions
```

---

## Example Scenarios

The repository includes device-verified reference scenarios across every supported type:

### Web — Orange HRM (Multi-Scenario)
[`scenarios/web/orangehrm/employee-portal.md`](scenarios/web/orangehrm/employee-portal.md) — Common Setup (login) + 3 scenarios (Apply Leave, Search Employee Directory, Post Buzz Message) + Common Teardown (logout). Tests section-aware incremental detection with isolated scenario changes.

### Web — SauceDemo (Single Scenario)
[`scenarios/web/saucedemo/checkout-flow.md`](scenarios/web/saucedemo/checkout-flow.md) — 24-step checkout flow (login, add to cart, checkout, confirm). Live browser-verified against https://www.saucedemo.com. Tests incremental detection for single-section files.

### API — JSONPlaceholder CRUD
[`scenarios/api/posts-crud-happy-path.md`](scenarios/api/posts-crud-happy-path.md) — 20-step CRUD flow against `https://jsonplaceholder.typicode.com`. Declares `## API Behavior: mock` so POST-then-GET mismatches aren't flagged as bugs. Demonstrates all REST verbs (GET, POST, PUT, PATCH, DELETE) + status + body assertions.

### Mobile — SpeedTest (Reference App)
[`scenarios/mobile/speedtest-run-test.md`](scenarios/mobile/speedtest-run-test.md) — SpeedTest by Ookla, minimal reference scenario (launch → tap GO → wait → capture speeds). Reliable smoke-test anchor — SpeedTest has a single stable `goButton` accessibility id, making it ideal for framework verification.

### Mobile — Flipkart (Production App, 43 Steps)
[`scenarios/mobile/flipkart-add-to-cart.md`](scenarios/mobile/flipkart-add-to-cart.md) — Full Flipkart checkout flow on real Android device. Search → product detail → Buy Now → address → order summary → payment page → navigate back → cart verify → remove item → home. Exercises `PopupGuard`, the React Native `waitForIdleTimeout: 0` fix, rotating banners, permission dialogs, and the full mobile keyword suite. Passes consistently on real device in ~2m 10s.

### Mobile — Framework Parity Verification
[`scenarios/mobile/test-lifecycle-hooks.md`](scenarios/mobile/test-lifecycle-hooks.md), [`test-verify-soft.md`](scenarios/mobile/test-verify-soft.md), [`test-datasets.md`](scenarios/mobile/test-datasets.md), [`test-shared-data.md`](scenarios/mobile/test-shared-data.md) — Four framework meta-tests that verify `before`/`beforeEach`/`afterEach`/`after` hook order, `VERIFY_SOFT` continuation after soft failure, `DATASETS` iteration as distinct `it()` blocks, and `SHARED_DATA` + `saveState`/`loadState` cross-scenario persistence. Run these against any reference app to validate your mobile setup end-to-end.

---

## Contributing

### Adding a New Scenario
1. Create `scenarios/{type}/{folder}/{scenario-name}.md` using the matching template:
   - **Web / API / hybrid:** [`scenarios/web/_template.md`](scenarios/web/_template.md)
   - **Mobile:** [`scenarios/mobile/_template.md`](scenarios/mobile/_template.md)
   - **Mobile-hybrid:** [`scenarios/mobile/_template-hybrid.md`](scenarios/mobile/_template-hybrid.md)
2. Configure the appropriate MCP server — see [Setup Step 4](#4-configure-mcp-servers-explorer-live-app-access):
   - **Web / hybrid:** Playwright MCP
   - **Mobile / mobile-hybrid:** Appium MCP (plus Appium 2.x server running on localhost:4723 and a connected device)
3. If onboarding a new application, set the right slot in `framework-config.json → appContext` for the scenario's type:
   - web → `appContext.web = "my-app.md"`
   - api → `appContext.api = "my-app-api.md"` (often empty)
   - mobile Android → `appContext.mobile.android = "my-app-android.md"`
   - mobile iOS → `appContext.mobile.ios = "my-app-ios.md"`

   The framework's recommended model is ONE REPO PER APPLICATION — a team owning an app with web + mobile sides keeps all per-type context files in the same repo under `scenarios/app-contexts/`. For mobile, Android and iOS usually get separate files because UI frameworks and permission flows diverge.
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
