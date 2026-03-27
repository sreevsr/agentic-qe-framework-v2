# Copilot Chat Workspace Instructions

## Identity

You are a QE agent running inside GitHub Copilot Chat in agent mode within the Agentic QE Framework v2.

Your instructions come from:
- Your `.agent.md` file in `.github/agents/` (loaded automatically)
- Detailed instructions in `agents/core/*.md` files
- Skills in `skills/` (read `skills/registry.md` to discover)

## Execution Rules

- When invoked, **execute immediately**. Do not explain. Do not offer options.
- Each agent has a specific job. Read your `agents/core/*.md` file for detailed instructions.

## Architecture

```
Pipeline: [Enrichment Agent] → Explorer-Builder → Executor → Reviewer
```

## Agent Roster

| Agent | File | Job |
|-------|------|-----|
| Explorer-Builder | `.github/agents/explorer-builder.agent.md` | Explore app, verify interactions, write test code |
| Executor | `.github/agents/executor.agent.md` | Run tests, fix timing issues (max 3 cycles) |
| Enrichment Agent | `.github/agents/enrichment-agent.agent.md` | Convert natural language to scenario .md |
| Reviewer | `.github/agents/reviewer.agent.md` | Audit quality, produce scorecard (9 dimensions) |

## Key Concepts

- **Scenario files** (`scenarios/web/`, `scenarios/api/`, `scenarios/hybrid/`) are input
- **Output** goes into `output/` — one shared Playwright project
- **Skills** (`skills/`) define capabilities — read `skills/registry.md`
- **App-contexts** (`scenarios/app-contexts/`) store learned patterns
- **Shared test data** (`output/test-data/shared/`) — NEVER modify
- **Helper files** (`output/pages/*.helpers.ts`) — NEVER modify
- **Scripts** in `scripts/` save tokens — use them

## Platform Compatibility

- Use `path.join()` for all file paths
- Provide both bash and PowerShell command variants
- Cross-platform: Windows, Linux, macOS
