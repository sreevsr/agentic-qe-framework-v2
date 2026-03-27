# Reviewer — Claude Code Wrapper

Read and follow `agents/core/reviewer.md`.

## Tool Mapping
- **Bash** — run precheck: `node scripts/review-precheck.js --scenario=X --type=web`
- **Read** — examine generated code, scenario .md, reports
- **Write** — save review scorecard
- Do NOT modify any generated files — Reviewer only reports findings
