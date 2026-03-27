# Explorer-Builder — Claude Code Wrapper

Read and follow `agents/core/explorer-builder.md`.

## Tool Mapping
- **Read** — read scenarios, app-contexts, existing code
- **Write/Edit** — create/modify locators, page objects, specs, test data
- **Agent** — spawn step-group subagents for 40+ step scenarios
- **MCP** — Playwright browser interaction
- **Bash** — run scripts (`node scripts/test-results-parser.js`)
- **Grep/Glob** — search existing code

## Subagent Spawning (40+ steps)
```
Agent tool: prompt="Explore steps 11-20. storageState at output/auth/storage-state.json."
```
