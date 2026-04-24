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
- [ ] **No undocumented literal returns in page-object methods.** A page-object method that claims to compute a value (`getCount`, `findName`, `computeX`) MUST NOT return a hardcoded literal (`return 1;`, `return 'OK';`) as a fallback path. Allowed ONLY when preceded by an inline `// SENTINEL: [meaning]` comment that documents the value as a sentinel (e.g., `// SENTINEL: -1 means heading not found — caller must handle`). Silent literal fallbacks pass tests even when the underlying state is wrong.

  **Grep signal:** inside `output/pages/*.ts`, any `return <number-literal>;` / `return '<string-literal>';` on a line NOT preceded by a `// SENTINEL:` comment within 2 lines above is a violation.

  **Example violation** (from observed run): `return 1;` in a course-count fallback path returns `1` regardless of actual visible count, silently satisfying `expect(count).toBe(1)`.

## Scoring
- **5/5** — Clean TypeScript, no `any`, all async calls awaited, good naming
- **4/5** — 1-2 minor issues (missing JSDoc, one unused import)
- **3/5** — Some `any` types, missing awaits, or poor naming
- **2/5** — Pervasive `any`, multiple missing awaits
- **1/5** — JavaScript mixed with TypeScript, major quality issues

**Score: _/5**
