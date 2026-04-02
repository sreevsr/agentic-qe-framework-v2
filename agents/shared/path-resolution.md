# Path Resolution — Single Source of Truth

**MANDATORY: All agents MUST use these path patterns. DO NOT hardcode paths — look them up here. If a path changes, update THIS file and all agents automatically use the new path.**

---

## Scenario Input Paths

| Type | Pattern |
|------|---------|
| web | `scenarios/web/{scenario}.md` or `scenarios/web/{folder}/{scenario}.md` |
| api | `scenarios/api/{scenario}.md` or `scenarios/api/{folder}/{scenario}.md` |
| hybrid | `scenarios/hybrid/{scenario}.md` or `scenarios/hybrid/{folder}/{scenario}.md` |
| mobile | `scenarios/mobile/{scenario}.md` or `scenarios/mobile/{folder}/{scenario}.md` |
| Swagger specs | `scenarios/api/swagger-specs/{spec}.json` (raw) / `{spec}.parsed.json` (parsed) |
| Enriched scenarios | `scenarios/{type}/[{folder}/]{scenario}.enriched.md` (created by Explorer, user-owned after first creation) |
| App-contexts | `scenarios/app-contexts/{app-identifier}.md` |
| Scout app-context | `scenarios/app-contexts/{app-identifier}-scout.md` (created by Scout, user merges into main) |

---

## Output Paths (Generated Test Project)

| File Type | Pattern |
|-----------|---------|
| Spec files | `output/tests/{type}/[{folder}/]{scenario}.spec.ts` |
| Page objects | `output/pages/{PageName}Page.ts` |
| Helper files | `output/pages/{PageName}Page.helpers.ts` (team-owned, read-only) |
| Locator JSONs | `output/locators/{page-name}.locators.json` (created by Scout, read by Builder) |
| Scout page inventory | `output/scout-reports/{app}-page-inventory.json` |
| Scout feasibility data | `output/scout-reports/{app}-feasibility-data.json` |
| Mobile locators | `output/locators/mobile/{screen-name}.locators.json` |
| Screen objects | `output/screens/{ScreenName}Screen.ts` (mobile) |
| Test data (scenario) | `output/test-data/{type}/{scenario}.json` |
| Test data (shared) | `output/test-data/shared/{dataset}.json` (immutable) |
| Shared state | `output/test-data/shared-state.json` (runtime, gitignored) |
| External datasets | `output/test-data/datasets/{file}.csv` / `{file}.xlsx` / `{file}.json` |
| Config | `output/playwright.config.ts` |
| Package | `output/package.json` |
| Core framework | `output/core/base-page.ts`, `locator-loader.ts`, `test-data-loader.ts`, `shared-state.ts` |
| Auth state | `output/auth/storage-state.json` (gitignored — contains tokens) |

---

## Plan Paths (v3 Pipeline)

| File Type | Pattern |
|-----------|---------|
| Execution plan | `output/plans/{type}/[{folder}/]{scenario}.plan.json` |
| Shared flow fragments | `shared-flows/{flow-name}.plan-fragment.json` |

---

## Report Paths

| Report | Pattern |
|--------|---------|
| Replay report | `output/reports/[{folder}/]replay-report-{scenario}.md` |
| Healer report | `output/reports/[{folder}/]healer-report-{scenario}.md` |
| Review scorecard | `output/reports/[{folder}/]review-scorecard-{scenario}.md` |
| Enrichment report | `output/reports/[{folder}/]enrichment-report-{scenario}.md` |
| Plan generator report | `output/reports/[{folder}/]plan-generator-report-{scenario}.md` |
| Pipeline summary | `output/reports/[{folder}/]pipeline-summary-{scenario}.md` |
| Allure results | `output/test-results/allure-results/{scenario}-result.json` |
| Explorer report (legacy) | `output/reports/[{folder}/]explorer-report-{scenario}.md` |
| Executor report (legacy) | `output/reports/[{folder}/]executor-report-{scenario}.md` |
| Precheck report (legacy) | `output/reports/[{folder}/]precheck-report-{scenario}.json` |
| Failure analysis | `output/reports/failure-analysis.json` |
| Defect tracking summary | `output/reports/defect-tracking-summary.json` |

---

## Metrics Paths

| Metric | Pattern |
|--------|---------|
| Explorer metrics | `output/reports/metrics/explorer-metrics-{scenario}.json` |
| Executor metrics | `output/reports/metrics/executor-metrics-{scenario}.json` |
| Pipeline metrics | `output/reports/metrics/pipeline-metrics-{timestamp}.json` |
| Eval summary | `output/reports/metrics/eval-summary-{scenario}.json` |
| Stability history | `output/test-results/test-stability-history.json` |

---

## Transient Paths (Gitignored)

| File | Pattern | Purpose |
|------|---------|---------|
| Playwright results | `output/test-results/results.json` | Raw JSON reporter output |
| Parsed results | `output/test-results/last-run-parsed.json` | Structured failure data |
| Error context | `output/test-results/error-context.md` | DOM snapshot at failure |
| Failure screenshots | `output/test-results/test-failed-*.png` | Visual state at failure |
| HTML report | `output/playwright-report/` | Playwright HTML report |
| Screenshots | `output/screenshots/` | Manual screenshots |
| Scenario changeset | `output/reports/scenario-changeset.json` | From scenario-diff.js |
| Skill hashes | `skills/.skill-hashes.json` | Drift detection |
| Lock file | `output/test-data/shared-state.json.lock` | Concurrent write lock |

---

## Agent Instruction Paths

| File | Purpose |
|------|---------|
| `agents/core/orchestrator.md` | Orchestrator pipeline coordinator (v3) |
| `agents/core/plan-generator.md` | Plan Generator — MCP exploration → plan.json |
| `agents/core/plan-healer.md` | Plan Healer — surgical fix for failing plan steps |
| `agents/core/plan-reviewer.md` | Plan Reviewer — 1:1 mapping, quality score (v3) |
| `agents/core/explorer-builder.md` | Explorer/Builder core instructions (legacy) |
| `agents/core/code-generation-rules.md` | Code patterns, locator JSON, spec structure |
| `agents/core/quality-gates.md` | Fidelity, guardrails, popups, i18n |
| `agents/core/scenario-handling.md` | Multi-scenario, app-context, subagents |
| `agents/core/bug-detection-rules.md` | Bug vs test issue classification (3Q + tables) |
| `agents/core/executor.md` | Executor core instructions |
| `agents/core/enrichment-agent.md` | Enrichment Agent core instructions |
| `agents/core/reviewer.md` | Reviewer core instructions (legacy — 9-dimension code review) |
| `framework-config.json` | Configurable retries, timeouts, bug detection settings |
| `agents/shared/keyword-reference.md` | Keyword → code patterns |
| `agents/shared/guardrails.md` | Enterprise ownership boundaries |
| `agents/shared/type-registry.md` | Type definitions and per-agent lookup |
| `agents/shared/path-resolution.md` | This file — path single source of truth |
| `agents/04-reviewer/dimensions/dim-*.md` | 9 quality dimension checklists |
| `agents/04-reviewer/scorecard-template.md` | Scorecard output format |
| `agents/report-templates/pipeline-summary.md` | Pipeline summary report standard |
| `agents/report-templates/explorer-report.md` | Explorer/Builder report template |
| `agents/report-templates/executor-report.md` | Executor report template |
| `agents/report-templates/enrichment-report.md` | Enrichment Agent report template |
| `skills/registry.md` | Skills index |

---

## Script Commands

| Script | Command |
|--------|---------|
| Setup | `node setup.js` |
| Precheck | `node scripts/review-precheck.js --scenario={name} --type={type} [--folder={folder}]` |
| Parse results | `node scripts/test-results-parser.js --results-dir=output/test-results` |
| Swagger parser | `node scripts/swagger-parser.js --spec={path} [--output={path}]` |
| Scenario diff | `node scripts/scenario-diff.js --scenario={path} [--spec={path}]` |
| Failure classifier | `node scripts/failure-classifier.js --results={path} [--scenario={name}]` |
| Metrics collector | `node scripts/metrics-collector.js --run-type={pipeline\|nightly}` |
| Eval summary | `node scripts/eval-summary.js --scenario={name} [--folder={folder}]` |
| Rehash skills | `node scripts/rehash-skills.js [--check]` |
| CI test runner | `node ci/scripts/ci-test-runner.js --suite={name} [--browser={name}] [--shard=N/M]` |

---

## Test Execution Commands

### v3 Pipeline — Web Replay Engine (plan-based, no generated code)
```bash
npx tsx scripts/replay-engine.ts --plan=output/plans/{type}/[{folder}/]{scenario}.plan.json [--headed] [--browser=chromium] [--report=output/reports/replay-report-{scenario}.md]
```

### v3 Pipeline — Mobile Replay Engine (Appium-based)
```bash
npx tsx scripts/mobile-replay-engine.ts --plan=output/plans/mobile/[{folder}/]{scenario}.plan.json [--report=output/reports/replay-report-{scenario}.md]
```

### Legacy Pipeline — Playwright Test (code-based, generated spec files)
```bash
cd output && npx playwright test tests/{type}/[{folder}/]{scenario}.spec.ts --project=chrome --reporter=json,list
```

**MUST specify the exact spec/plan file.** NEVER run without a file path — it executes ALL tests.

---

## Platform Notes

- ALL paths use forward slashes in this document for readability
- In code, **MUST** use `path.join()` — NEVER hardcode `/` or `\`
- Windows: use `npm.cmd`/`npx.cmd` instead of `npm`/`npx`
