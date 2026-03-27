# Quality Gates — Explorer-Builder Guardrails and Validation

**This file is MANDATORY reading for the Explorer-Builder. Every rule here is NON-NEGOTIABLE. There are NO exceptions unless explicitly stated.**

---

## 1. Scenario-to-Code Fidelity — ZERO TOLERANCE

**This is the single most important quality dimension. A spec that drops steps or misses assertions is WORSE than one that fails — at least a failing test is honest.**

### 1.1: Step Counting — MANDATORY

**Step numbering is positional, not user-authored.** The user's step numbers in the scenario .md may be wrong, duplicated, or out of order.

1. Read the scenario top-to-bottom
2. Assign sequential numbers by position: first step = 1, second = 2, etc.
3. Number continuously across ALL sections: Common Setup Once → Common Setup → Scenario → Common Teardown → Common Teardown Once
4. `test.step('Step N — ...')` uses these positional numbers

### 1.2: Self-Validation Gate — HARD STOP Before Finishing

**MANDATORY: You MUST perform this self-check BEFORE declaring exploration complete. DO NOT skip this. DO NOT approximate. COUNT EXACTLY.**

1. Count every step in the source scenario (by position, across all sections)
2. Count every `test.step()` call in your generated spec (including `test.fixme()` for blocked steps)
3. **Counts MUST match exactly.** If mismatch → find the missing steps and add them NOW
4. Count VERIFY in scenario → count `expect()` hard assertions in spec → MUST match
5. Count VERIFY_SOFT in scenario → count `expect.soft()` blocks in spec → MUST match
6. Count CAPTURE in scenario → count variable captures in spec → MUST match
7. Count SCREENSHOT in scenario → count `page.screenshot()` + `attach()` in spec → MUST match
8. If lifecycle hooks exist in scenario → verify corresponding beforeAll/beforeEach/afterEach/afterAll exist in spec

**If ANY count does not match → DO NOT finish. Go back and fix the gap.**

### 1.3: What Fidelity Means — MANDATORY Understanding

- Every scenario step → EXACTLY one `test.step()` block (or `test.fixme()` if blocked)
- Every VERIFY → EXACTLY one `expect()` hard assertion
- Every VERIFY_SOFT → EXACTLY one `expect.soft()` in block scope with auto-screenshot
- Every CAPTURE → EXACTLY one variable assignment
- Steps MUST appear in the SAME order as the scenario
- Step labels MUST match scenario intent — NO meaning-changing paraphrases
- NO steps combined, merged, or simplified
- NO steps added that are NOT in the scenario

---

## 2. Guardrail Quick Reference — HARD RULES

### MUST DO — EVERY TIME, NO EXCEPTIONS:
- Read ALL pre-flight files before starting (see explorer-builder.md Section 2)
- Verify EVERY interaction in the live browser before writing code
- Externalize ALL selectors to locator JSON files
- Wrap EVERY step in `test.step()`
- Follow keyword → code patterns from `keyword-reference.md` EXACTLY
- Save app-context patterns after exploration
- Produce explorer report AND metrics file
- Run fidelity self-validation before finishing

### MUST NOT — EVER — UNDER ANY CIRCUMSTANCES:
- **Selectors in code:** NO raw selectors in page objects or specs — ALL selectors go through LocatorLoader
- **Hardcoded waits:** NO `page.waitForTimeout()` without a `// PACING:` comment explaining why
- **Force bypasses:** NO `{ force: true }` — EVER — unless Scout report flags HIT-AREA MISMATCH
- **Hardcoded credentials:** NO passwords, tokens, keys in code — ALL via `process.env.*`
- **Changing assertions:** NEVER change expected values in VERIFY — wrong value = POTENTIAL BUG → use `test.fixme('POTENTIAL BUG: ...')`
- **Altering scenario:** NEVER change step order, skip steps, or take alternative flows
- **Helpers files:** NEVER create, modify, or delete `*.helpers.ts` — team-owned
- **Shared data:** NEVER modify `output/test-data/shared/` — cross-scenario, immutable
- **Wrong fixtures:** NEVER use `{ page }` or `{ request }` in beforeAll/afterAll — ONLY `{ browser }`
- **Wrong HTTP client:** NEVER use `fetch` or `axios` — ONLY Playwright `request` fixture
- **Silent failures:** NEVER skip a step without `test.fixme()` — every gap must be documented

### POTENTIAL BUG SIGNALS — Flag, DO NOT adapt:

When you observe these, mark with `test.fixme('POTENTIAL BUG: ...')` and document in the explorer report. DO NOT change the test to make it pass:

- VERIFY fails but selector IS correct (element found, wrong content displayed)
- API POST returns 2xx but subsequent GET returns 404 (resource not persisted)
- PUT/PATCH returns 2xx but GET shows old values (update not applied)
- UI state contradicts API response (hybrid — page shows "Success" but API returned 500)
- Element visible but disabled/overlapped when scenario expects it to be clickable

---

## 3. File Ownership — HARD BOUNDARIES

| Files | Owner | Your Access | Violation Consequence |
|-------|-------|------------|----------------------|
| `scenarios/*.md` | User/Tester | **Read ONLY** | Altering scenario = broken fidelity |
| `output/pages/*.helpers.ts` | Team | **Read ONLY** | Modifying helpers = overwriting team work |
| `output/test-data/shared/` | Team | **Read ONLY** | Modifying shared data = breaking other scenarios |
| `output/core/*` | Framework (setup.js) | **Read ONLY** | Modifying core = framework corruption |
| `output/pages/*.ts` | You (Explorer-Builder) | **Create/Modify** | |
| `output/locators/*.json` | You (Explorer-Builder) | **Create/Modify** | |
| `output/tests/**/*.spec.ts` | You (Explorer-Builder) | **Create/Modify** | |
| `output/test-data/{type}/*.json` | You (Explorer-Builder) | **Create/Modify** | |
| `scenarios/app-contexts/*.md` | You (Explorer-Builder) | **Read/Write** | |

**PRE-EDIT GATE: Before editing ANY file, check its path:**
- Ends with `.helpers.ts` → **STOP. DO NOT EDIT.** Use `test.fixme('HELPER ISSUE: ...')` instead
- Inside `test-data/shared/` → **STOP. DO NOT EDIT.** Create scenario-level override instead
- Inside `core/` → **STOP. DO NOT EDIT.** Report as framework issue

---

## 4. API Behavior Guardrail

**MANDATORY: Read the scenario header for `## API Behavior: mock` or `## API Behavior: live`.**

- `mock` → API is non-persistent. You MAY adapt tests for non-persistence (use existing IDs, accept mock responses). Document as "Mock API Adaptation" in report.
- `live` or missing → **ALL persistence guardrails apply with ZERO exceptions.** POST-then-GET MUST find the resource. No rationalization. No workarounds.
- **NEVER infer API behavior from the URL or API name.** ONLY the explicit header controls this.

---

## 5. Cookie Consent, Notification Popups, and Overlays

### 5.1: During Exploration — MANDATORY Handling

During the core loop, if a popup or overlay appears that is NOT in the scenario:

**Cookie consent banner:**
1. Look for dismiss buttons: "Accept", "Accept All", "OK", "Got it", "Close"
2. Click dismiss
3. **MUST** record in app-context: `## Known Popup: Cookie Consent — dismissed via [selector]`
4. **MUST** add dismissal code in the spec BEFORE scenario steps (not AS a scenario step):
   ```typescript
   // Dismiss cookie consent if present
   const cookieBanner = page.locator('[data-testid="cookie-accept"], .cookie-consent-accept, button:has-text("Accept All")');
   if (await cookieBanner.isVisible({ timeout: 3000 }).catch(() => false)) {
     await cookieBanner.click();
   }
   ```

**Notification toast/snackbar:**
1. Wait for auto-dismiss (most toasts disappear in 3-5 seconds)
2. If blocking and won't dismiss → find close button
3. **MUST** record in app-context

**Unexpected modal dialog:**
1. Take screenshot
2. Try to dismiss (close button, ESC, click outside)
3. If recurring → add to app-context
4. If blocks test flow and can't be dismissed → `test.fixme('BLOCKED BY UNEXPECTED DIALOG: ...')`

### 5.2: Browser-Level Settings

When you discover the app needs specific browser settings, note in the explorer report:
```typescript
// Recommendations for playwright.config.ts:
use: {
  permissions: ['geolocation', 'notifications'],
  bypassCSP: true,
  acceptDownloads: true,
}
```

---

## 6. Localization and Non-English Applications

### 6.1: Selector Strategy — MANDATORY for Localized UIs

When the app is non-English or multi-locale, text-based selectors break across languages.

**ADJUSTED selector priority for localized apps:**

1. `data-testid` — **ALWAYS prefer** (language-independent)
2. `id` attribute — language-independent
3. `name` attribute — language-independent
4. `role` + `aria-label` — may be localized but stable within a locale
5. **AVOID as PRIMARY:** `text=`, `has-text()`, `placeholder=` — these change with locale

**If forced to use text-based selectors:**
- **MUST** record the locale in app-context: `## Localization: App uses [locale]. Text selectors are locale-dependent.`
- **MUST** add structural CSS fallbacks that don't depend on text

### 6.2: RTL (Right-to-Left) Languages

For Arabic, Hebrew, etc.:
- **MUST NOT** use position-based selectors (left/right reverse in RTL)
- **MUST** use semantic selectors (`role`, `aria-label`) instead
- **MUST** note RTL behavior in app-context

### 6.3: Non-Latin Character Input

When filling inputs with CJK, Cyrillic, Arabic, etc.:
- Try `fill()` first (handles Unicode correctly in most cases)
- If `fill()` fails → try `pressSequentially()` or `page.keyboard.type()`
- **MUST** record working input method in app-context

### 6.4: Locale-Aware Assertions

- **MUST** use the EXACT expected text from the scenario (user provides locale-correct values)
- **MUST NOT** translate or normalize text
- For date/number format verification → use the format matching the scenario's locale

### 6.5: Multi-Locale Testing

If the scenario switches locales:
- Each locale switch = a scenario step (explicit)
- After switching, re-verify elements are in the new language
- **MUST** use `data-testid` as the universal selector when available
- If locale-specific text selectors are unavoidable, store as separate locator entries:
  ```json
  {
    "submitButton": { "primary": "[data-testid='submit-btn']" },
    "submitButton_en": { "primary": "button:has-text('Submit')" },
    "submitButton_es": { "primary": "button:has-text('Enviar')" }
  }
  ```
  The `data-testid` version is ALWAYS the preferred universal selector.
