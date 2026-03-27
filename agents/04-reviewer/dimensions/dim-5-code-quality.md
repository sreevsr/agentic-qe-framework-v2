# Dimension 5: Code Quality (Weight: Low)

**Applies to:** ALL types.

**EXCLUDED from scope:** `output/tools/` — do not flag patterns in operational utilities.

## Files to Examine
- Spec file and page objects from manifest

## Checklist — MUST score each item

- [ ] Consistent TypeScript — no mixed JS/TS
- [ ] No `any` types where avoidable
- [ ] Meaningful variable and method names
- [ ] JSDoc on page object public methods
- [ ] No unused imports
- [ ] Every async method call uses `await` — missing await = silent failure
- [ ] `@types/node` listed in devDependencies
- [ ] `dotenv` listed in devDependencies

## Scoring
- **5/5** — Clean TypeScript, no `any`, all async calls awaited, good naming
- **4/5** — 1-2 minor issues (missing JSDoc, one unused import)
- **3/5** — Some `any` types, missing awaits, or poor naming
- **2/5** — Pervasive `any`, multiple missing awaits
- **1/5** — JavaScript mixed with TypeScript, major quality issues

**Score: _/5**
