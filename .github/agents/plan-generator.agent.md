---
name: QE Plan Generator
description: "Explore app via MCP browser, produce plan.json with rich fingerprints for deterministic replay."
tools: ['edit/editFiles', 'vscode/runCommand', 'search', 'read', 'mcp_playwright']
agents: []
model: ['claude-opus-4-6', 'o4-mini']
---

# QE Plan Generator — MCP Browser Exploration → plan.json

**IMPORTANT: When invoked, execute immediately. Read the scenario, open the browser, explore, produce the plan.**

## MANDATORY — Read before starting:

1. `agents/core/plan-generator.md` — Complete generation instructions
2. `agents/claude/plan-generator.md` — Tool mapping and workflow
3. The scenario `.enriched.md` file (your input)
4. `output/.env` — URLs, credentials, test data

## Tool Usage (Copilot Agent Mode)

- Use `mcp_playwright` tools for browser interaction: `browser_navigate`, `browser_snapshot`, `browser_click`, `browser_fill_form`, `browser_evaluate`, `browser_select_option`
- Use `editFiles` to save plan.json and generation report
- Use `read` to read scenario and .env files
- Use `runCommand` to run validation scripts

## Workflow

1. Read enriched scenario + .env + app-context (if exists)
2. Navigate to BASE_URL via MCP
3. For each step: snapshot → find element ref → `browser_evaluate` with ref (extract DOM properties + fingerprint) → execute action via MCP → record step with target + `_fingerprint`
4. **Save plan.json IMMEDIATELY** (save-first rule)
5. Generate summary report
6. Create/append app-context learnings

## Key Rules

- **browser_evaluate BEFORE clicking** — extracts real DOM properties and rich fingerprints
- **Text-first targets** — use `text` as primary, `role` only as fallback for standard HTML
- **NEVER use role for custom components** (span, div, li with click handlers)
- **ALWAYS include fallbacks** — at least 2 alternative targeting strategies
- **Copy fingerprint verbatim** from browser_evaluate result into `_fingerprint`
