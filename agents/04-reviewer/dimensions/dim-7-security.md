# Dimension 7: Security (Weight: High)

**Applies to:** ALL types.

## Files to Examine
- Spec file from manifest
- `output/.env.example`
- `.gitignore`

## Checklist — MUST score each item

- [ ] No passwords, tokens, or secrets hardcoded anywhere in code
- [ ] All credentials use `process.env.VARIABLE_NAME`
- [ ] `.env.example` exists with placeholder variable names (never real credentials)
- [ ] `.gitignore` includes `.env`
- [ ] Scenario `.md` files use `{{ENV.VARIABLE}}` pattern, not real values
- [ ] Storage state files (`output/auth/*.json`) are gitignored (contain auth tokens)

## Scoring
- **5/5** — Zero hardcoded secrets, all env vars properly referenced, gitignore complete
- **4/5** — 1 minor issue (e.g., .env.example missing a variable)
- **3/5** — 1 hardcoded value that should be env var, or .env not gitignored
- **2/5** — Multiple hardcoded credentials or missing security config
- **1/5** — Real credentials in committed code

**Score: _/5**
