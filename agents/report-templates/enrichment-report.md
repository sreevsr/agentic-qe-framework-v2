# Enrichment Report Template

**Owner:** Enrichment Agent
**Purpose:** Documents the enrichment process — what input was received, what questions were asked, what assumptions were made, and what scenario was produced.

**MANDATORY when enrichment is performed (natural language or Swagger input). NOT required for passthrough (structured .md input).**

---

## Template

```markdown
# Enrichment Report: {scenario-name}

## Summary
- **Date:** {Month DD, YYYY, HH:MM AM/PM UTC}
- **Input type:** {Natural language | Partial/mixed | Swagger/OpenAPI spec}
- **Source:** {user message | file path to spec}
- **Output:** scenarios/{type}/{scenario-name}.md
- **Confidence:** {0.0-1.0}
- **Questions asked:** {N} (rounds: {N} of 2 max)
- **Assumptions made:** {N}

---

## Input Received

### Original User Input
```
{exact text or file path provided by the user}
```

### App-Context Used
- **File:** {scenarios/app-contexts/{app}.md | Not found}
- **Patterns applied:** {list what was used from app-context, or "No app-context available"}

---

## Clarification Q&A

### Round 1
| # | Question Asked | User Answer |
|---|---------------|-------------|
| 1 | {question} | {answer} |
| 2 | {question} | {answer} |
[Or "No questions needed — input was sufficiently detailed."]

### Round 2 (if needed)
| # | Question Asked | User Answer |
|---|---------------|-------------|
| 1 | {question} | {answer} |
[Or "Not needed — Round 1 resolved all ambiguities."]

---

## Swagger/OpenAPI Details (if applicable)

- **Spec file:** {path to .json spec}
- **Parsed file:** {path to .parsed.json}
- **Resources found:** {N}
- **Scenarios generated:** {N}

| Resource | Endpoints | Scenarios Generated |
|----------|----------|-------------------|
| /users | GET, POST, PUT, DELETE | users-crud, users-negative, users-edge-cases |
| /products | GET, POST | products-crud, products-list |
[Or "N/A — not a Swagger input."]

---

## Assumptions Made

| # | Assumption | Why | Impact if Wrong |
|---|-----------|-----|-----------------|
| 1 | Login uses Microsoft SSO | App-context says SSO | Explorer-Builder will discover actual login flow |
| 2 | Pagination uses standard next/prev buttons | Common pattern | Explorer-Builder will verify live |
| 3 | Grid filters apply on Enter key | No info from user | Explorer-Builder may need to try Apply button |
[List EVERY assumption. Or "None — all details provided by user or app-context."]

---

## Enrichment Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| Type | web | User mentioned "browse" and "click" — UI interaction |
| Priority | P1 | Default — user didn't specify |
| Tags | regression, P1, sme-directory | Inferred from module name |
| VERIFY placement | After every navigation and filter action | Best practice — user didn't specify assertions |
| SCREENSHOT placement | After login, after filter, final state | Key milestone evidence |
[Document what the Enrichment Agent decided and why.]

---

## Output Scenario Summary

- **File:** scenarios/{type}/{scenario-name}.md
- **Type:** {web | api | hybrid | mobile | mobile-hybrid}
- **Steps:** {N}
- **Keywords used:** VERIFY: {N}, VERIFY_SOFT: {N}, CAPTURE: {N}, SCREENSHOT: {N}, API: {N}
- **Lifecycle hooks:** {beforeAll/beforeEach/afterEach/afterAll — which are present}
- **Tags:** {list}
- **DATASETS:** {Yes ({N} rows) | No}
- **SHARED_DATA:** {dataset names | None}

---

## Confidence Assessment

| Factor | Score | Notes |
|--------|-------|-------|
| User provided clear details | {0-1} | {explanation} |
| App-context available and useful | {0-1} | {explanation} |
| Minimal assumptions needed | {0-1} | {explanation} |
| **Overall confidence** | **{0.0-1.0}** | |

{If confidence < 0.7: "User should review the generated scenario before running Explorer-Builder. Assumptions are listed above."}
{If confidence >= 0.7: "Scenario is ready for Explorer-Builder."}

---

## Observability & Eval

### Token Usage
| Metric | Value |
|--------|-------|
| Tokens used | {N} |
| Context window | {N}% |
| Duration | ~{N} minutes |
| Input tokens (user input + app-context + spec) | ~{N} |
| Output tokens (scenario .md + report) | ~{N} |

### Enrichment Quality Eval
| Metric | Value |
|--------|-------|
| Confidence score | {0.0-1.0} |
| Questions asked | {N} (rounds: {N}) |
| Assumptions made | {N} |
| Steps generated | {N} |
| Keywords used | VERIFY: {N}, CAPTURE: {N}, SCREENSHOT: {N}, API: {N} |
| Scenarios generated (Swagger) | {N} or N/A |

{If Swagger input: "Coverage: {N}/{M} endpoints covered ({X}% of spec)"}

---

## Notes for Explorer-Builder

{Any additional context that the Explorer-Builder should know:
- Known app quirks from app-context
- Uncertain steps that may need live verification
- Suggested pacing for slow components
- Or "No special notes."}
```

---

## Save Location

- With folder: `output/reports/{folder}/enrichment-report-{scenario}.md`
- Without folder: `output/reports/enrichment-report-{scenario}.md`

## When to Generate

| Input Type | Generate Report? |
|-----------|-----------------|
| Natural language | **YES** — always |
| Partial/mixed | **YES** — always |
| Swagger/OpenAPI spec | **YES** — always |
| Structured .md (passthrough) | **NO** — no enrichment performed |
