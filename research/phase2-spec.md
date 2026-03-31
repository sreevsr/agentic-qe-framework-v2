# Phase 2 Spec: Plan Schema + Web Replay Engine

## Date: 2026-03-31
## Status: DRAFT — for review

---

## What We're Building

Three things:

1. **Plan Schema** — a JSON format that describes WHAT to test (declarative, cached, version-controlled)
2. **Replay Engine** — a Node.js CLI that reads a plan and drives Playwright (deterministic, no LLM, fast)
3. **Plan Generator** — a modified Explorer that outputs a plan instead of enriched.md (LLM-powered, first-run only)

The healer (LLM-powered step repair) is Phase 3. This spec focuses on the schema and replay engine.

---

## Design Principles

1. **The plan is NOT code.** It's a declarative description of test intent. No imperative logic, no framework coupling.
2. **The replay engine is deterministic.** Given the same plan + same app state → same result. No LLM during replay.
3. **Reuse existing infrastructure.** LocatorLoader, test-data-loader, shared-state, BasePage patterns — all proven. Don't reinvent.
4. **Platform-agnostic plan, platform-specific engine.** The plan says WHAT. The adapter says HOW.
5. **Skills for complexity.** Simple steps = plan handles directly. Complex widgets = plan references a skill.

---

## 1. Plan Schema

### 1.1 Top-Level Structure

```json
{
  "schema": "agentic-qe/execution-plan/1.0",
  "scenario": {
    "name": "automationexercise-trial",
    "source": "scenarios/web/automationexercise-trial.md",
    "sourceHash": "sha256:a3f8c2...",
    "type": "web",
    "tags": ["e2e", "regression", "P1"]
  },
  "generatedAt": "2026-03-31T11:21:52Z",
  "generatedBy": "explorer-plan-generator/1.0",
  "planHash": "sha256:b7d9e1...",
  "environment": {
    "baseUrl": "{{ENV.BASE_URL}}",
    "variables": ["SIGNUP_EMAIL", "SIGNUP_PASSWORD", "CARD_NUMBER", "CARD_CVC", "CARD_EXP_MONTH", "CARD_EXP_YEAR"]
  },
  "dataSources": {},
  "setup": [],
  "steps": [],
  "teardown": [],
  "capturedVariables": {}
}
```

### 1.2 Field Definitions

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `schema` | string | YES | Schema version for forward compatibility |
| `scenario.name` | string | YES | Scenario identifier (maps to filename) |
| `scenario.source` | string | YES | Path to the source scenario .md |
| `scenario.sourceHash` | string | YES | SHA-256 of scenario .md — triggers re-generation if changed |
| `scenario.type` | enum | YES | `web`, `api`, `hybrid`, `mobile`, `mobile-hybrid` |
| `scenario.tags` | string[] | YES | CI/CD filtering tags |
| `generatedAt` | ISO 8601 | YES | When the plan was generated |
| `generatedBy` | string | YES | Generator identity + version |
| `planHash` | string | YES | SHA-256 of the steps array — cache invalidation |
| `environment.baseUrl` | string | YES | Base URL template |
| `environment.variables` | string[] | YES | Required ENV variables (validated before run) |
| `dataSources` | object | NO | External data file references |
| `setup` | Step[] | NO | Pre-test actions (API calls, DB seeding) |
| `steps` | Step[] | YES | Test steps |
| `teardown` | Step[] | NO | Post-test cleanup |

### 1.3 Step Schema

Every step has a common envelope:

```json
{
  "id": 1,
  "section": "Signup Flow",
  "description": "Navigate to BASE_URL",
  "type": "NAVIGATE",
  "action": { },
  "onFailure": "continue"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | number | YES | Sequential step number (1-based) |
| `section` | string | NO | Human-readable section name (from scenario headers) |
| `description` | string | YES | What this step does (from scenario text) |
| `type` | enum | YES | Step type (see 1.4) |
| `action` | object | YES | Type-specific action payload |
| `onFailure` | enum | NO | `continue` (default), `stop`, `heal` |

### 1.4 Step Types and Action Payloads

#### NAVIGATE

```json
{
  "type": "NAVIGATE",
  "action": {
    "url": "{{ENV.BASE_URL}}"
  }
}
```

#### ACTION — click

```json
{
  "type": "ACTION",
  "action": {
    "verb": "click",
    "target": {
      "role": "link",
      "name": "Signup / Login",
      "fallbacks": [
        {"text": "Signup / Login"},
        {"role": "link", "nameContains": "Signup"}
      ]
    }
  }
}
```

#### ACTION — fill

```json
{
  "type": "ACTION",
  "action": {
    "verb": "fill",
    "target": {
      "role": "textbox",
      "name": "Name"
    },
    "value": "{{testData.signupName}}"
  }
}
```

#### ACTION — fill_form (batch)

```json
{
  "type": "ACTION",
  "action": {
    "verb": "fill_form",
    "fields": [
      {"target": {"role": "textbox", "name": "First name *"}, "value": "QA"},
      {"target": {"role": "textbox", "name": "Last name *"}, "value": "Demo"},
      {"target": {"role": "textbox", "name": "Address *"}, "value": "{{testData.address}}"},
      {"target": {"role": "textbox", "name": "State *"}, "value": "{{testData.state}}"},
      {"target": {"role": "textbox", "name": "City *"}, "value": "{{testData.city}}"},
      {"target": {"role": "textbox", "name": "Mobile Number *"}, "value": "{{testData.phone}}"}
    ]
  }
}
```

#### ACTION — select

```json
{
  "type": "ACTION",
  "action": {
    "verb": "select",
    "target": {
      "role": "combobox",
      "name": "Country"
    },
    "value": "India"
  }
}
```

#### ACTION — hover

```json
{
  "type": "ACTION",
  "action": {
    "verb": "hover",
    "target": {
      "role": "generic",
      "name": "Blue Top product card"
    }
  }
}
```

#### ACTION — press_key

```json
{
  "type": "ACTION",
  "action": {
    "verb": "press_key",
    "key": "Enter"
  }
}
```

#### ACTION — drag

```json
{
  "type": "ACTION",
  "action": {
    "verb": "drag",
    "source": {"role": "listitem", "name": "Task 123"},
    "destination": {"role": "region", "name": "Done column"},
    "steps": 10
  }
}
```

#### ACTION — upload

```json
{
  "type": "ACTION",
  "action": {
    "verb": "upload",
    "target": {"role": "textbox", "name": "Choose file"},
    "files": ["test-data/files/invoice.pdf"]
  }
}
```

#### ACTION — download

```json
{
  "type": "ACTION",
  "action": {
    "verb": "download",
    "trigger": {"role": "link", "name": "Download Invoice"},
    "saveAs": "{{capturedVariables._downloads.invoice}}",
    "timeout": 10000
  }
}
```

#### ACTION — switch_frame

```json
{
  "type": "ACTION",
  "action": {
    "verb": "switch_frame",
    "frame": {"name": "payment-iframe"}
  }
}
```

To switch back to main frame:
```json
{
  "type": "ACTION",
  "action": {
    "verb": "switch_frame",
    "frame": "main"
  }
}
```

#### VERIFY

```json
{
  "type": "VERIFY",
  "action": {
    "assertion": "textVisible",
    "expected": "ACCOUNT CREATED!",
    "scope": null
  }
}
```

Assertion types:

| `assertion` | What It Checks | `expected` | `scope` |
|------------|---------------|-----------|---------|
| `textVisible` | Text appears on page | string | optional target |
| `textEquals` | Element text exactly equals | string | target (required) |
| `textContains` | Element text contains | string | target (required) |
| `elementVisible` | Element is visible | — | target (required) |
| `elementHidden` | Element is not visible | — | target (required) |
| `urlContains` | Current URL contains | string | — |
| `urlEquals` | Current URL equals | string | — |
| `valueEquals` | Variable equals expected | string | — |
| `valueContains` | Variable contains expected | string | — |
| `fileExists` | File exists at path | path | — |
| `fileContains` | File content contains | string | path |
| `screenshotMatch` | Visual regression | baseline filename | target (optional) |
| `countEquals` | Element count equals | number | target (required) |

Complex assertion example (address verification):

```json
{
  "type": "VERIFY",
  "action": {
    "assertion": "textContains",
    "target": {"role": "list", "name": "Your delivery address"},
    "expected": "{{capturedVariables.address}}"
  }
}
```

Multi-condition assertion:

```json
{
  "type": "VERIFY",
  "action": {
    "assertion": "allOf",
    "conditions": [
      {"assertion": "textContains", "target": {"role": "list", "name": "billing"}, "expected": "Mysore"},
      {"assertion": "textContains", "target": {"role": "list", "name": "billing"}, "expected": "Karnataka"},
      {"assertion": "textContains", "target": {"role": "list", "name": "billing"}, "expected": "570008"}
    ]
  }
}
```

#### VERIFY_SOFT

Same as VERIFY, but `onFailure` defaults to `continue` (test continues even if assertion fails, but is marked as failed in report).

```json
{
  "type": "VERIFY_SOFT",
  "action": {
    "assertion": "textVisible",
    "expected": "Cart badge shows 2"
  }
}
```

#### CAPTURE

```json
{
  "type": "CAPTURE",
  "action": {
    "target": {"role": "heading", "nameContains": "Rs."},
    "scope": {"role": "generic", "name": "Blue Top product card"},
    "extract": "textContent",
    "captureAs": "blueTopPrice"
  }
}
```

Extract types:
- `textContent` — element's visible text
- `inputValue` — input/textarea value
- `attribute:{name}` — specific attribute value
- `count` — number of matching elements

#### CALCULATE

```json
{
  "type": "CALCULATE",
  "action": {
    "expression": "parseFloat('{{blueTopPrice}}'.replace('Rs. ','')) + parseFloat('{{menTshirtPrice}}'.replace('Rs. ','')) + parseFloat('{{fancyGreenTopPrice}}'.replace('Rs. ','')) + parseFloat('{{frozenTopPrice}}'.replace('Rs. ',''))",
    "resultFormat": "Rs. {{result}}",
    "captureAs": "expectedTotal"
  }
}
```

#### SCREENSHOT

```json
{
  "type": "SCREENSHOT",
  "action": {
    "name": "cart-with-all-items",
    "fullPage": true,
    "target": null
  }
}
```

#### REPORT

```json
{
  "type": "REPORT",
  "action": {
    "message": "Blue Top price = {{blueTopPrice}}"
  }
}
```

#### API_CALL (for setup/teardown and hybrid tests)

```json
{
  "type": "API_CALL",
  "action": {
    "method": "POST",
    "url": "{{ENV.API_URL}}/api/users",
    "headers": {
      "Authorization": "Bearer {{ENV.API_TOKEN}}",
      "Content-Type": "application/json"
    },
    "body": {
      "name": "Test User {{_runtime.timestamp}}",
      "email": "test_{{_runtime.runId}}@example.com"
    },
    "captureAs": "createdUser",
    "captureFields": {
      "userId": "$.id",
      "email": "$.email"
    },
    "expectedStatus": 201
  }
}
```

#### DB_QUERY (for setup/teardown)

```json
{
  "type": "DB_QUERY",
  "action": {
    "connection": "{{ENV.DB_CONNECTION_STRING}}",
    "query": "INSERT INTO users (name, email) VALUES ($1, $2) RETURNING id",
    "params": ["Test User", "test_{{_runtime.runId}}@example.com"],
    "captureAs": "dbUser",
    "captureFields": {
      "userId": "$.rows[0].id"
    }
  }
}
```

#### WRITE_DATA

```json
{
  "type": "WRITE_DATA",
  "action": {
    "format": "json",
    "file": "output/captured-results.json",
    "data": {
      "orderNumber": "{{orderNumber}}",
      "total": "{{totalPrice}}",
      "runDate": "{{_runtime.timestamp}}"
    }
  }
}
```

For CSV append:
```json
{
  "type": "WRITE_DATA",
  "action": {
    "format": "csv",
    "file": "output/order-history.csv",
    "mode": "append",
    "row": ["{{_runtime.timestamp}}", "{{orderNumber}}", "{{totalPrice}}"]
  }
}
```

#### SKILL (for complex widgets)

```json
{
  "type": "SKILL",
  "action": {
    "skill": "ag-grid/read-cell",
    "params": {
      "container": {"role": "grid", "name": "Orders"},
      "row": {"containsText": "{{testData.orderNumber}}"},
      "column": "Price"
    },
    "captureAs": "itemPrice"
  }
}
```

#### WAIT

```json
{
  "type": "WAIT",
  "action": {
    "condition": "networkIdle",
    "timeout": 5000
  }
}
```

Wait conditions:
- `networkIdle` — no network activity for 500ms
- `elementVisible` — element appears (needs `target`)
- `elementHidden` — element disappears (needs `target`)
- `urlContains` — URL matches pattern (needs `expected`)
- `delay` — explicit pause in ms (needs `duration`) — use sparingly

#### FOR_EACH (data-driven loops)

```json
{
  "type": "FOR_EACH",
  "action": {
    "collection": "{{dataSources.expectedOrders}}",
    "as": "order",
    "steps": [
      {
        "type": "VERIFY",
        "action": {
          "assertion": "textVisible",
          "expected": "{{order.productName}}",
          "scope": {"role": "table", "name": "Order Review"}
        }
      }
    ]
  }
}
```

#### CONDITIONAL

```json
{
  "type": "CONDITIONAL",
  "action": {
    "if": {"elementVisible": {"role": "dialog", "name": "Cookie Consent"}},
    "then": [
      {
        "type": "ACTION",
        "action": {"verb": "click", "target": {"role": "button", "name": "Accept"}}
      }
    ],
    "else": []
  }
}
```

### 1.5 Element Targeting

Every `target` object follows this resolution order:

```json
{
  "target": {
    "role": "button",
    "name": "Submit",
    "nameContains": null,
    "text": null,
    "testId": null,
    "label": null,
    "placeholder": null,
    "within": null,
    "frame": null,
    "nth": null,
    "fallbacks": []
  }
}
```

**Resolution priority** (replay engine tries in order):
1. `role` + `name` → `page.getByRole(role, { name })`
2. `role` + `nameContains` → `page.getByRole(role, { name: /nameContains/i })`
3. `label` → `page.getByLabel(label)`
4. `placeholder` → `page.getByPlaceholder(placeholder)`
5. `testId` → `page.getByTestId(testId)`
6. `text` → `page.getByText(text)`
7. `fallbacks[0]`, `fallbacks[1]`, ... → try each in order

**Scoping:**
- `within` → narrows search to a container: `page.locator(within).getByRole(...)`
- `frame` → switches to iframe first: `page.frameLocator(frame).getByRole(...)`
- `nth` → disambiguates when multiple matches: `.nth(n)`

### 1.6 Variable System

Three namespaces:

| Namespace | Syntax | Source | Mutable? |
|-----------|--------|--------|----------|
| `ENV` | `{{ENV.BASE_URL}}` | `output/.env` | No |
| `testData` | `{{testData.signupName}}` | `dataSources` files | No |
| `capturedVariables` | `{{blueTopPrice}}` | CAPTURE / API_CALL results | Yes (append-only) |
| `_runtime` | `{{_runtime.timestamp}}` | System-generated | No |
| `dataSources` | `{{dataSources.orders[0].name}}` | External files | No |
| `_downloads` | `{{_downloads.invoice}}` | Download file paths | Yes |

**Runtime variables** (`_runtime`):
- `_runtime.timestamp` — ISO 8601 execution start time
- `_runtime.runId` — unique run identifier (UUID)
- `_runtime.stepNumber` — current step number
- `_runtime.sectionName` — current section name

### 1.7 Data Sources

```json
{
  "dataSources": {
    "orders": {
      "file": "test-data/web/expected-orders.json",
      "format": "json"
    },
    "products": {
      "file": "test-data/shared/products.csv",
      "format": "csv"
    },
    "pricing": {
      "file": "test-data/web/pricing.xlsx",
      "format": "excel",
      "sheet": "Q3 Prices"
    }
  }
}
```

Loaded by the replay engine at startup using existing `test-data-loader.ts` functions.

---

## 2. Web Replay Engine

### 2.1 Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│  replay-engine.ts                                                │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐       │
│  │ Plan Loader   │  │ Env Resolver │  │ Data Source       │       │
│  │ (JSON parse + │  │ (.env file + │  │ Loader            │       │
│  │  schema       │  │  runtime     │  │ (JSON/CSV/Excel)  │       │
│  │  validation)  │  │  variables)  │  │                   │       │
│  └──────┬───────┘  └──────┬───────┘  └────────┬──────────┘       │
│         │                 │                    │                  │
│         ▼                 ▼                    ▼                  │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │  Step Executor (core loop)                                │    │
│  │  FOR EACH step in plan.steps:                             │    │
│  │    resolve variables in step                              │    │
│  │    dispatch to handler by step.type                       │    │
│  │    record result (PASS/FAIL/SKIP)                         │    │
│  │    update captured variables                              │    │
│  └──────────────────────────┬───────────────────────────────┘    │
│                             │                                    │
│              ┌──────────────┼──────────────┐                     │
│              ▼              ▼              ▼                     │
│  ┌────────────────┐ ┌─────────────┐ ┌──────────────┐            │
│  │ Element         │ │ Assertion   │ │ Skill         │            │
│  │ Resolver        │ │ Engine      │ │ Loader        │            │
│  │ (target →       │ │ (VERIFY →   │ │ (skill name → │            │
│  │  Playwright     │ │  expect())  │ │  code module) │            │
│  │  Locator)       │ │             │ │               │            │
│  └───────┬────────┘ └──────┬──────┘ └───────┬──────┘            │
│          │                 │                │                    │
│          ▼                 ▼                ▼                    │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │  Playwright CDP (browser driver)                          │    │
│  └──────────────────────────────────────────────────────────┘    │
│                             │                                    │
│                             ▼                                    │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │  Report Generator                                         │    │
│  │  (step results → markdown + optional JUnit XML)           │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### 2.2 CLI Interface

```bash
# Replay a cached plan
node replay-engine.js \
  --plan=plans/web/automationexercise-trial.plan.json \
  --browser=chromium \
  --headed \
  --report=output/reports/replay-report.md

# With dataset override
node replay-engine.js \
  --plan=plans/web/checkout.plan.json \
  --data=test-data/web/premium-user.json

# With tag filter (run only steps in tagged sections)
node replay-engine.js \
  --plan=plans/web/full-regression.plan.json \
  --tags=smoke

# Dry run (validate plan, check env vars, check data files — no browser)
node replay-engine.js \
  --plan=plans/web/checkout.plan.json \
  --dry-run

# Generate JUnit XML for CI/CD
node replay-engine.js \
  --plan=plans/web/checkout.plan.json \
  --report-format=junit \
  --report=output/reports/results.xml
```

### 2.3 Element Resolver

The resolver translates plan `target` objects into Playwright `Locator` instances.

```typescript
// Pseudocode — the core resolver logic
function resolveTarget(page: Page, target: Target, frame?: FrameRef): Locator {
  let context: Page | FrameLocator = page;

  // Frame handling
  if (target.frame || frame) {
    const f = target.frame || frame;
    if (f === 'main') {
      context = page;
    } else if (f.name) {
      context = page.frameLocator(`[name="${f.name}"]`);
    } else if (f.chain) {
      context = f.chain.reduce(
        (ctx, name) => ctx.frameLocator(`[name="${name}"]`),
        page as Page | FrameLocator
      );
    }
  }

  // Scoping
  if (target.within) {
    context = resolveTarget(page, target.within);
  }

  // Primary resolution
  let locator: Locator;

  if (target.role && target.name) {
    locator = context.getByRole(target.role, { name: target.name, exact: false });
  } else if (target.role && target.nameContains) {
    locator = context.getByRole(target.role, { name: new RegExp(target.nameContains, 'i') });
  } else if (target.label) {
    locator = context.getByLabel(target.label);
  } else if (target.placeholder) {
    locator = context.getByPlaceholder(target.placeholder);
  } else if (target.testId) {
    locator = context.getByTestId(target.testId);
  } else if (target.text) {
    locator = context.getByText(target.text);
  }

  // nth disambiguation
  if (target.nth !== undefined && target.nth !== null) {
    locator = locator.nth(target.nth);
  }

  return locator;
}

// Fallback resolution
async function resolveWithFallbacks(page: Page, target: Target, timeout: number): Promise<Locator> {
  // Try primary
  const primary = resolveTarget(page, target);
  if (await primary.isVisible({ timeout: 2000 }).catch(() => false)) {
    return primary;
  }

  // Try fallbacks
  for (const fallback of (target.fallbacks || [])) {
    const loc = resolveTarget(page, fallback);
    if (await loc.isVisible({ timeout: 2000 }).catch(() => false)) {
      return loc;
    }
  }

  // Nothing found — return primary (will fail with Playwright's timeout error)
  return primary;
}
```

### 2.4 Step Handlers

Each step type maps to a handler function:

```typescript
const handlers: Record<StepType, StepHandler> = {
  NAVIGATE:    handleNavigate,
  ACTION:      handleAction,
  VERIFY:      handleVerify,
  VERIFY_SOFT: handleVerifySoft,
  CAPTURE:     handleCapture,
  CALCULATE:   handleCalculate,
  SCREENSHOT:  handleScreenshot,
  REPORT:      handleReport,
  API_CALL:    handleApiCall,
  DB_QUERY:    handleDbQuery,
  WRITE_DATA:  handleWriteData,
  SKILL:       handleSkill,
  WAIT:        handleWait,
  FOR_EACH:    handleForEach,
  CONDITIONAL: handleConditional,
};
```

Each handler:
1. Resolves `{{variables}}` in the step's action payload
2. Executes the action
3. Returns a `StepResult`: `{ status: 'pass' | 'fail' | 'skip', duration: number, evidence?: string, error?: string }`

### 2.5 Variable Resolution

```typescript
function resolveVariables(template: string, context: VariableContext): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
    const value = getNestedValue(context, path.trim());
    if (value === undefined) {
      throw new Error(`Unresolved variable: ${match}`);
    }
    return String(value);
  });
}

// Context built at startup:
const context: VariableContext = {
  ENV: loadedEnvVars,
  testData: mergedTestData,
  dataSources: loadedDataSources,
  _runtime: { timestamp, runId, stepNumber: 0 },
  _downloads: {},
  // capturedVariables are added during execution
  ...capturedVariables,
};
```

### 2.6 Pre-Flight Validation (Dry Run)

Before opening a browser, the replay engine validates:

1. **Plan schema** — JSON conforms to schema (required fields, valid types)
2. **Environment variables** — all `environment.variables` are set in `.env`
3. **Data sources** — all referenced files exist and are parseable
4. **Skills** — all referenced skills exist in `skills/` directory
5. **Variable references** — all `{{...}}` references can be resolved (except `capturedVariables` which are runtime)
6. **Circular references** — no variable references itself

If validation fails, the engine prints errors and exits without launching a browser.

### 2.7 Report Generation

Output: `output/reports/replay-report-{scenario}-{timestamp}.md`

Uses the same format as `direct-executor-report.md` (already created in Phase 1), with additions:
- Plan version and hash
- Cache hit/miss status
- Step-by-step results with timing
- Captured variables table
- Screenshots
- JUnit XML option for CI/CD

### 2.8 Configuration

Pulls from existing `framework-config.json`:

```typescript
const config = {
  timeouts: {
    action: frameworkConfig.timeouts.actionTimeoutMs,      // 30000
    navigation: frameworkConfig.timeouts.navigationTimeoutMs, // 60000
    test: frameworkConfig.timeouts.testTimeoutMs,           // 180000
  },
  screenshots: {
    onFailure: true,   // auto-screenshot on step failure
    directory: 'output/screenshots/',
  },
  reports: {
    directory: 'output/reports/',
    format: 'markdown', // or 'junit'
  },
};
```

---

## 3. Plan Generator (Modified Explorer)

### 3.1 How It Differs From Current Explorer

| Current Explorer | Plan Generator |
|---|---|
| Reads 8+ instruction files | Reads scenario + .env only |
| Produces enriched.md | Produces execution-plan.json |
| Records page-step mappings | Records element targets with fallbacks |
| Flags missing Scout elements | Discovers element targets directly |
| Documents for Builder | Documents for replay engine |

### 3.2 Generation Flow

```
1. Read scenario .md
2. Run step-classifier.js to pre-classify steps
3. Open browser, navigate to BASE_URL
4. FOR EACH step:
   a. Take accessibility snapshot (if needed)
   b. Find the target element in the snapshot
   c. Record: role, name, fallbacks, frame context
   d. Execute the action
   e. Verify it worked (post-action snapshot if needed)
   f. Write step to plan JSON
5. Save plan to plans/{type}/{scenario}.plan.json
6. Compute planHash and sourceHash
```

### 3.3 Target Discovery

When the Explorer finds an element, it records multiple targeting strategies:

```
Snapshot shows: button "Submit" [ref=e74]

Plan Generator records:
{
  "role": "button",           ← primary: ARIA role + name
  "name": "Submit",
  "fallbacks": [
    {"text": "Submit"},       ← fallback 1: text content
    {"testId": "submit-btn"}  ← fallback 2: data-testid if present
  ]
}
```

For ambiguous elements (multiple "Add to cart" buttons), the generator records scoping:

```
{
  "role": "generic",
  "name": "Add to cart",
  "within": {
    "role": "generic",
    "name": "Blue Top product card"
  }
}
```

---

## 4. File Layout

```
plans/
├── web/
│   └── automationexercise-trial.plan.json
├── api/
├── hybrid/
├── mobile/
skills/
├── replay/                    ← NEW: replay-specific skill implementations
│   ├── ag-grid.skill.ts
│   ├── highcharts.skill.ts
│   ├── salesforce-lookup.skill.ts
│   └── sap-fiori-table.skill.ts
scripts/
├── step-classifier.js          ← already built
├── replay-engine.js            ← NEW: the replay engine entry point
├── plan-generator.js           ← NEW: CLI wrapper for plan generation
├── plan-validator.js            ← NEW: schema validation + dry run
output/
├── reports/
│   └── replay-report-{scenario}-{timestamp}.md
├── screenshots/
```

---

## 5. Example: automationexercise-trial Plan (abbreviated)

```json
{
  "schema": "agentic-qe/execution-plan/1.0",
  "scenario": {
    "name": "automationexercise-trial",
    "source": "scenarios/web/automationexercise-trial.md",
    "sourceHash": "sha256:...",
    "type": "web",
    "tags": ["e2e", "regression", "P1"]
  },
  "generatedAt": "2026-03-31T11:21:52Z",
  "generatedBy": "explorer-plan-generator/1.0",
  "planHash": "sha256:...",
  "environment": {
    "baseUrl": "{{ENV.BASE_URL}}",
    "variables": ["BASE_URL", "SIGNUP_EMAIL", "SIGNUP_PASSWORD", "CARD_NUMBER", "CARD_CVC", "CARD_EXP_MONTH", "CARD_EXP_YEAR"]
  },
  "dataSources": {},
  "setup": [],
  "steps": [
    {
      "id": 1,
      "section": "Signup Flow",
      "description": "Navigate to BASE_URL",
      "type": "NAVIGATE",
      "action": {"url": "{{ENV.BASE_URL}}"}
    },
    {
      "id": 2,
      "section": "Signup Flow",
      "description": "Click Signup / Login link",
      "type": "ACTION",
      "action": {
        "verb": "click",
        "target": {
          "role": "link",
          "name": "Signup / Login",
          "fallbacks": [{"text": "Signup / Login"}]
        }
      }
    },
    {
      "id": 3,
      "section": "Signup Flow",
      "description": "Enter name and email in signup form",
      "type": "ACTION",
      "action": {
        "verb": "fill_form",
        "fields": [
          {"target": {"role": "textbox", "name": "Name"}, "value": "QA Demo"},
          {"target": {"role": "textbox", "name": "Email Address", "within": {"role": "generic", "name": "New User Signup!"}}, "value": "qademo_{{_runtime.runId}}@testmail.com"}
        ]
      }
    },
    {
      "id": 18,
      "section": "Shopping Flow",
      "description": "CAPTURE: Blue Top price",
      "type": "CAPTURE",
      "action": {
        "target": {"role": "heading", "nameContains": "Rs.", "within": {"role": "generic", "name": "Blue Top"}},
        "extract": "textContent",
        "captureAs": "blueTopPrice"
      }
    },
    {
      "id": 37,
      "section": "Cart Verification",
      "description": "VERIFY: Blue Top is in cart",
      "type": "VERIFY",
      "action": {
        "assertion": "textVisible",
        "expected": "Blue Top",
        "scope": {"role": "table"}
      }
    },
    {
      "id": 56,
      "section": "Order Review",
      "description": "CALCULATE: expectedTotal",
      "type": "CALCULATE",
      "action": {
        "expression": "parseFloat('{{blueTopPrice}}'.replace('Rs. ','')) + parseFloat('{{menTshirtPrice}}'.replace('Rs. ','')) + parseFloat('{{fancyGreenTopPrice}}'.replace('Rs. ','')) + parseFloat('{{frozenTopPrice}}'.replace('Rs. ',''))",
        "resultFormat": "Rs. {{result}}",
        "captureAs": "expectedTotal"
      }
    },
    {
      "id": 70,
      "section": "Order Confirmation",
      "description": "Download Invoice",
      "type": "ACTION",
      "action": {
        "verb": "download",
        "trigger": {"role": "link", "name": "Download Invoice"},
        "saveAs": "{{_downloads.invoice}}"
      }
    },
    {
      "id": 72,
      "section": "Order Confirmation",
      "description": "VERIFY: Invoice contains QA Demo",
      "type": "VERIFY",
      "action": {
        "assertion": "fileContains",
        "expected": "QA Demo",
        "path": "{{_downloads.invoice}}"
      }
    }
  ],
  "teardown": []
}
```

---

## 6. Speed Projections

| Phase | What Happens | Time |
|-------|-------------|------|
| Pre-flight validation | Schema + env + data check | <500ms |
| Browser launch | Playwright chromium.launch() | ~1-2s |
| Step execution (77 steps) | Playwright actions (no LLM) | ~10-20s |
| Screenshots (4) | page.screenshot() | ~1s |
| Report generation | Write markdown | <200ms |
| **Total** | | **~12-24s** |

This is comparable to Playwright spec execution (14s) because it IS Playwright — just driven by a plan instead of TypeScript.

---

## 7. What This Does NOT Cover (Future Phases)

| Capability | Phase |
|---|---|
| Plan Healer (LLM repairs broken steps) | Phase 3 |
| Mobile adapter (Appium) | Phase 3 |
| Desktop adapter (FlaUI / SAP COM) | Phase 4 |
| Parallel plan execution | Phase 3 |
| Plan diffing (show what changed between versions) | Phase 3 |
| CI/CD integration (GitHub Actions workflow) | Phase 3 |
| App-context updates from plan runs | Phase 3 |

---

## 8. Open Questions

1. **Plan storage location:** `output/plans/` — plans are generated artifacts that live inside the output project. **DECIDED.**

2. **Plan vs scenario coupling:** One plan per scenario. Data is injected at runtime via `--data` flag. **DECIDED.**

3. **Skill implementation language:** TypeScript functions (`.skill.ts`) that receive a Playwright `Page` and return results. **DECIDED.**

4. **Popup handling:** Built-in popup dismissal module in the replay engine. Runs after every navigation. Covers cookie banners, browser notifications, JS dialogs, overlay ads, marketing modals. **DECIDED.**

5. **Element fingerprints:** YES — stored as healer-only metadata (`_fingerprint` field). The replay engine ignores them completely. They exist for the Phase 3 healer to understand what changed when a step fails. **DECIDED.**

---

## 9. Implementation Order

| # | What | Files | Estimated Effort |
|---|------|-------|-----------------|
| 1 | Plan JSON Schema (validation) | `schemas/execution-plan.schema.json` | Small |
| 2 | Plan Validator (dry run) | `scripts/plan-validator.js` | Small |
| 3 | Element Resolver | `scripts/replay/element-resolver.ts` | Medium |
| 4 | Step Handlers | `scripts/replay/step-handlers.ts` | Medium |
| 5 | Variable Resolver | `scripts/replay/variable-resolver.ts` | Small |
| 6 | Replay Engine (orchestrator) | `scripts/replay-engine.ts` | Medium |
| 7 | Report Generator | `scripts/replay/report-generator.ts` | Small |
| 8 | Plan Generator (modified Explorer) | `agents/core/plan-generator.md` | Medium |
| 9 | First skill: popup dismissal | `skills/replay/popup-dismiss.skill.ts` | Small |
| 10 | End-to-end test: replay automationexercise-trial | — | Validation |
