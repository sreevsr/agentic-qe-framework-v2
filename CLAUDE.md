# Agentic QE Framework v2 — Claude Code Instructions

## Identity

You are an AI agent within the Agentic QE Framework v2. This framework generates production-quality Playwright test automation code from scenario descriptions.

## Architecture

```
Pipeline: [Enrichment Agent] → Explorer-Builder → Executor → Reviewer
```

- **Enrichment Agent**: Converts natural language input to structured scenario .md (interactive Q&A)
- **Explorer-Builder**: Opens live browser, explores each step, verifies interactions, writes code
- **Executor**: Runs generated tests, fixes timing issues (max 3 cycles)
- **Reviewer**: Audits code quality against 9 dimensions, produces scorecard

## Key Principles

1. **Build what works, not what you think should work** — every interaction is verified in a live browser before being coded
2. **Scripts for evidence, LLMs for judgment** — deterministic tasks use scripts, reasoning uses the LLM
3. **Scenario integrity is sacred** — NEVER alter, skip, or reorder scenario steps to make tests pass
4. **No hardcoded waits, no hardcoded credentials, no force bypasses**
5. **Selectors live in JSON, not in code** — all selectors externalized to locator files

## Directory Structure

```
agents/core/            — Platform-neutral agent instructions
agents/shared/          — Cross-agent references (keyword-reference, guardrails, type-registry)
agents/claude/          — Claude Code-specific agent wrappers
skills/                 — Skills registry with three-level progressive disclosure
contracts/              — Agent input/output manifests for Agent Hub integration
scripts/                — Deterministic scripts (no LLM, no tokens)
templates/              — Config and core file templates for output/
scenarios/              — Test scenario .md files (web/, api/, hybrid/)
scenarios/app-contexts/ — Learned application patterns (persisted across runs)
output/                 — Generated Playwright test project
ci/                     — CI/CD scripts, workflows, defect tracker integrations
```

## Execution Rules

- When invoked as an agent, execute immediately. Do not explain. Do not offer options.
- Read your agent instruction file from `agents/core/` for detailed behavior.
- Read `agents/shared/keyword-reference.md` for scenario keyword → code patterns.
- Read `agents/shared/guardrails.md` for enterprise ownership boundaries.
- Read `agents/shared/type-registry.md` for type-specific behavior.
- Read `skills/registry.md` to discover available skills.

## Platform Compatibility

- Use `path.join()` for all file paths (never hardcode `/` or `\`)
- Framework runs on Windows, Linux, and macOS

## File Ownership

| Files | Owner | Agent Access |
|-------|-------|-------------|
| `scenarios/*.md` | User/Tester | Read only |
| `output/pages/*.helpers.ts` | Team | Read only — NEVER modify |
| `output/test-data/shared/` | Team | Read only — NEVER modify |
| `output/core/*` | Framework | Managed by setup.js |
| `output/pages/*.ts` | Explorer-Builder | Create/modify |
| `output/locators/*.json` | Explorer-Builder | Create/modify |
| `output/tests/**/*.spec.ts` | Explorer-Builder | Create/modify |
| `scenarios/app-contexts/*.md` | Explorer-Builder | Read/write |

## Scripts

Run scripts to save tokens:
- `node scripts/review-precheck.js --scenario=X --type=web` — evidence collection
- `node scripts/test-results-parser.js --results-dir=output/test-results` — parse results
- `node scripts/failure-classifier.js --results=output/test-results/last-run-parsed.json` — classify failures
- `node scripts/metrics-collector.js` — aggregate metrics
