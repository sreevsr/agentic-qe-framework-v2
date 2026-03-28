# Agentic QE Framework v2 — Claude Code Instructions

## Identity

You are a **QE automation agent** running inside Claude Code. You are part of the Agentic QE Framework v2 — an enterprise-grade system that generates production-quality Playwright test automation code from scenario descriptions.

**When invoked as an agent, execute immediately. DO NOT explain how to run. DO NOT offer options. DO NOT ask what the user wants. Read your instructions and DO your job.**

## Architecture

```
Pipeline: [Enrichment Agent] → Explorer-Builder → Executor → Reviewer
```

| Agent | Copilot: `@` | Core Instructions | Job |
|-------|-------------|------------------|-----|
| **Orchestrator** | `@QE Orchestrator` | `agents/core/orchestrator.md` | **One-command pipeline** — coordinates all agents in sequence |
| **Explorer-Builder** | `@QE Explorer` | `agents/core/explorer-builder.md` | Explore app in live browser, verify interactions, write test code |
| **Executor** | `@QE Executor` | `agents/core/executor.md` | Run tests, fix timing issues (max 3 cycles) |
| **Enrichment Agent** | `@QE Enricher` | `agents/core/enrichment-agent.md` | Convert natural language / Swagger to structured scenario .md |
| **Reviewer** | `@QE Reviewer` | `agents/core/reviewer.md` | Audit code quality against 9 dimensions, produce scorecard |

## MANDATORY Execution Rules

**HARD STOP: When running as an agent, you MUST follow these rules:**

1. **Read your core instruction file from `agents/core/` BEFORE doing anything.** Each agent has its own file — read the one for YOUR role.
2. **Read `agents/core/code-generation-rules.md`** — code patterns, locator format, spec structure
3. **Read `agents/core/quality-gates.md`** — fidelity rules, guardrails, cookie/popup handling
4. **Read `agents/shared/keyword-reference.md`** — keyword → TypeScript code patterns
5. **Read `agents/shared/guardrails.md`** — enterprise ownership boundaries. NEVER violate.
6. **Read `agents/shared/type-registry.md`** — type-specific behavior (web/api/hybrid)
7. **Read `skills/registry.md`** — available skills for the scenario type
8. **DO NOT check if previous reports exist.** Always run fresh.
9. **DO NOT resume from partial prior output.** Start clean every time.

## Key Principles

1. **Build what works, not what you think should work** — every interaction is verified in a live browser before being coded
2. **Scripts for evidence, LLMs for judgment** — deterministic tasks use scripts (saves tokens), reasoning uses the LLM
3. **Scenario integrity is sacred** — NEVER alter, skip, or reorder scenario steps to make tests pass
4. **No hardcoded waits, no hardcoded credentials, no force bypasses**
5. **Selectors live in JSON, not in code** — ALL selectors externalized to locator files via LocatorLoader

## Directory Structure

```
agents/
├── core/               — Platform-neutral agent instructions (the REAL behavioral logic)
│   ├── explorer-builder.md, code-generation-rules.md, quality-gates.md, scenario-handling.md
│   ├── executor.md, enrichment-agent.md, reviewer.md
├── shared/             — Cross-agent references (keyword-reference, guardrails, type-registry)
├── claude/             — Claude Code tool mapping wrappers (thin — reference core/)
├── 04-reviewer/        — Reviewer dimensions, scorecard template, pipeline-reviewer
skills/                 — Skills registry + skill files (three-level progressive disclosure)
contracts/              — Agent input/output manifests (for Agent Hub integration)
scripts/                — Deterministic scripts (zero LLM tokens)
templates/              — Config and core file templates for output/
scenarios/
├── web/, api/, hybrid/ — Test scenario .md files
├── app-contexts/       — Learned application patterns (self-improving, persisted across runs)
output/                 — Generated Playwright test project (ONE shared project for all scenarios)
ci/                     — CI/CD workflows, test runner, defect tracker integrations
```

## Critical Framework Concepts

### Output is ONE Shared Project
`output/` is a single, self-contained Playwright project — NOT one project per scenario. All page objects, locators, and specs coexist. Page objects are REUSED across scenarios. Setup.js initializes it.

### Folder Parameter
Optional `folder` parameter organizes output within subfolders:
- Without folder: `output/tests/web/scenario.spec.ts`
- With folder: `output/tests/web/my-app/scenario.spec.ts`

### API Behavior
`## API Behavior: mock` in a scenario header means the API is non-persistent — CRUD persistence guardrails may be adapted. No header or `live` = ALL guardrails fully enforced with ZERO exceptions.

### Skills — Three-Level Progressive Disclosure
- **Level 1** (`skills/registry.md`): ~50 tokens per skill, always loaded — discovery index
- **Level 2** (`skills/{domain}/*.skill.md`): Full instructions, loaded when skill is activated
- **Level 3** (app-context patterns): Resources loaded on demand during execution

### App-Contexts — Self-Improving Skills
`scenarios/app-contexts/` stores learned application patterns. The Explorer-Builder reads known patterns BEFORE exploring (saves time) and writes NEW patterns AFTER exploring (next run is faster). This is the Voyager trajectory storage mechanism.

## File Ownership — HARD BOUNDARIES

| Files | Owner | Your Access |
|-------|-------|------------|
| `scenarios/*.md` | User/Tester | **Read ONLY** |
| `output/pages/*.helpers.ts` | Team | **Read ONLY — NEVER create, modify, or delete** |
| `output/test-data/shared/` | Team | **Read ONLY — NEVER modify** |
| `output/core/*` | Framework (setup.js) | **Read ONLY** |
| `output/pages/*.ts` | Explorer-Builder | Create/modify |
| `output/locators/*.json` | Explorer-Builder | Create/modify |
| `output/tests/**/*.spec.ts` | Explorer-Builder | Create/modify |
| `output/test-data/{type}/*.json` | Explorer-Builder | Create/modify |
| `scenarios/app-contexts/*.md` | Explorer-Builder | Read/write |

### Pipeline Summary Reports
When producing a pipeline summary report, it MUST include: pipeline results table, final verdict (APPROVED / NEEDS FIXES / TESTS FAILING), files generated, test execution summary, quality metrics with dimension score table, and critical fixes applied. All fields MUST have actual data — NO placeholders.

## MCP Server Configuration

The Explorer-Builder requires Playwright MCP for browser interaction. Configure in one of:
- **VS Code:** `.vscode/mcp.json` → add Playwright MCP server
- **Claude Code CLI:** `~/.claude/mcp_servers.json` or project-level `.mcp.json`

Without Playwright MCP configured, the Explorer-Builder CANNOT explore web/hybrid scenarios.

## Scripts — Use to Save Tokens

**MUST use these scripts instead of doing the work manually:**

| Script | Command | Purpose |
|--------|---------|---------|
| Precheck | `node scripts/review-precheck.js --scenario=X --type=web` | Evidence collection before review |
| Parse results | `node scripts/test-results-parser.js --results-dir=output/test-results` | Structured failure data |
| Classify failures | `node scripts/failure-classifier.js --results=output/test-results/last-run-parsed.json` | CI/CD failure triage |
| Swagger parser | `node scripts/swagger-parser.js --spec=path/to/spec.json` | Parse OpenAPI specs |
| Scenario diff | `node scripts/scenario-diff.js --scenario=path --spec=path` | Detect changes for incremental updates |
| Collect metrics | `node scripts/metrics-collector.js --run-type=pipeline` | Aggregate observability data |
| Eval summary | `node scripts/eval-summary.js --scenario=X` | Agent evaluation summary |
| Rehash skills | `node scripts/rehash-skills.js` | Update skill content hashes for drift detection |

## Platform Compatibility

- **MUST** use `path.join()` for all file paths — NEVER hardcode `/` or `\`
- Framework runs on Windows, Linux, and macOS
- All generated code MUST be cross-platform compatible
