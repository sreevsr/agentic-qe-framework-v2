# Dimension 7: Security (Weight: High)

**Applies to:** ALL types.

## Files to Examine
- Spec file from manifest
- `output/.env.example` (informational only — see "Out of Scope" below)
- `.gitignore`
- Page object files (for hardcoded credential strings)

## Checklist — MUST score each item

- [ ] No passwords, tokens, or secrets hardcoded anywhere in code
- [ ] All credentials use `process.env.VARIABLE_NAME`
- [ ] `.gitignore` includes `.env`
- [ ] Scenario `.md` files use `{{ENV.VARIABLE}}` pattern, not real values
- [ ] Storage state files (`output/auth/*.json`) are gitignored (contain auth tokens)

## Out of Scope — `.env.example` Completeness

**Per `agents/core/quality-gates.md` §2b, the completeness of `output/.env.example` is NOT a scored item in this dimension.**

`.env.example` is a developer-onboarding template (analogous to `.vscode/mcp.example.json`) — it is NOT a runtime dependency. Tests read `.env`, not `.env.example`. The scenario `.md` `## Application` section is the authoritative source for which env vars a scenario uses.

- **MUST NOT** dock Dimension 7 score for missing `LM_URL`, `BASE_URL`, or any other `process.env.X` reference being absent from `.env.example`.
- **MAY** add a Recommendation (nice-to-have) line noting that the next developer setting up the project may benefit from a placeholder entry — but ONLY if the project explicitly designates `.env.example` as its onboarding contract.
- **MUST NOT** raise this as a Critical Issue under any circumstance.
- Real credentials APPEARING in `.env.example` IS still a Critical Issue (that's a leak) — score it under "hardcoded secrets" instead.

## Scoring
- **5/5** — Zero hardcoded secrets, all env vars properly referenced, gitignore complete
- **4/5** — 1 minor issue (e.g., one storage state file accidentally tracked, or scenario `.md` contains a literal credential value)
- **3/5** — 1 hardcoded value that should be env var, or `.env` not gitignored
- **2/5** — Multiple hardcoded credentials or missing security config
- **1/5** — Real credentials in committed code

**Score: _/5**
