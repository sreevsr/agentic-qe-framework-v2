# Orchestrator — Claude Code Wrapper

**IMPORTANT: When invoked, execute immediately. DO NOT explain. DO NOT ask options. Run the pipeline.**

You are the **Orchestrator** (`@QE Orchestrator` in Copilot). You coordinate the complete QE pipeline.

## MANDATORY — Read before starting:

1. `agents/core/orchestrator.md` — Complete pipeline instructions
2. `agents/shared/path-resolution.md` — All file paths
3. `agents/shared/type-registry.md` — Type-specific behavior

## Tool Mapping (Claude Code)

| Claude Code Tool | Use For |
|-----------------|---------|
| **Agent** | Delegate to subagents: Enricher, Plan Generator, Plan Healer, Reviewer |
| **Bash** | Run replay engine, run scripts (plan-validator, cleanup), verify file existence |
| **Write** | Save pipeline summary to output/reports/ |
| **Read** | Read agent reports to extract data for pipeline summary |
| **Grep/Glob** | Find scenario files, verify output |

**CRITICAL:** Pipeline summary MUST be saved as file using Write — do NOT just print in chat.

## Subagent Invocation (Claude Code)

```
Agent tool call:
  prompt: "Read agents/core/plan-generator.md for instructions.
           SCENARIO_NAME=unify-user-photos SCENARIO_TYPE=web
           Enriched scenario: scenarios/web/unify-user-photos.enriched.md
           App-context: scenarios/app-contexts/unify.md
           Save plan to: output/plans/web/unify-user-photos.plan.json
           Save report to: output/reports/plan-generator-report-unify-user-photos.md"
```

**MUST include instruction file reads in EVERY subagent prompt** — subagents do NOT inherit your context.

## Pipeline (v3)

```
Pre-Checks → Enrichment → Plan Generation → Replay → Heal (if needed) → Reviewer → Summary
```

| Stage | Agent/Tool | Output |
|-------|-----------|--------|
| Pre-Checks | Bash (validate .env, check existing plan) | go/no-go |
| Enrichment | QE Enricher subagent | .enriched.md |
| Plan Generation | QE Plan Generator subagent (web) or script (api/db) | plan.json |
| Replay | Bash: `npx tsx scripts/replay-engine.ts --plan=... --report=...` | replay-report.md |
| Heal | QE Plan Healer subagent + 2x Bash replay | healer-report.md + updated plan.json |
| Reviewer | QE Reviewer subagent | review-scorecard.md |
| Summary | Write tool | pipeline-summary.md |

## Replay Engine Command

```bash
npx tsx scripts/replay-engine.ts --plan=output/plans/{type}/{scenario}.plan.json --report=output/reports/replay-report-{scenario}.md --report-format=markdown [--headed] [--browser=chromium]
```

## Platform Compatibility

- Use `path.join()` for all file paths
- Cross-platform: Windows, Linux, macOS
