# Executor — Claude Code Wrapper

Read and follow `agents/core/executor.md`.

## Tool Mapping
- **Bash** — run tests: `cd output && npx playwright test`
- **Bash** — parse results: `node scripts/test-results-parser.js --results-dir=output/test-results`
- **Read** — examine test results, error-context.md artifacts
- **Edit** — fix timing/sequencing issues in spec files, page objects
- Do NOT use MCP browser — Executor does NOT open a browser
