# Skills Registry

**MANDATORY: The Explorer-Builder MUST read this file before starting exploration. This is the authoritative index of ALL available skills. DO NOT guess capabilities — check this registry. DO NOT use a skill not listed here.**

## Three-Level Progressive Disclosure

- **Level 1 (this file):** ~50 tokens per skill, always loaded — discovery index
- **Level 2 (`*.skill.md`):** Full instructions, loaded ONLY when the skill is activated for a step
- **Level 3 (app-context):** Application-specific patterns, loaded on demand during execution

**Drift detection:** Run `node scripts/rehash-skills.js` after modifying any skill file. If a skill changes after hashing, reload full instructions rather than relying on cached knowledge.

---

## Quick Decision Guide — Which Skill to Use

| User writes... | Skill | Key detail |
|----------------|-------|------------|
| "Navigate to...", "Go to...", "Open..." | `web/navigate` | Handles redirects, waits for load |
| "Click...", "Press...", "Select..." | `web/interact` | click, fill, select, check, hover, dblclick |
| "Enter...", "Type...", "Fill..." | `web/interact` | `fill` first; if no events, try `pressSequentially` |
| "VERIFY:", "Check that...", "Assert..." | `web/verify` | Hard assertion; NEVER change expected values |
| "VERIFY_SOFT:" | `web/verify` (soft) | Soft assertion + auto-screenshot on failure |
| "Wait for...", "Until..." | `web/wait` | NEVER use waitForTimeout — proper waits only |
| "CAPTURE:", "Read...", "Get value..." | `web/extract` | Returns value for later steps |
| "Scroll to...", "Scroll down" | `web/scroll` | Handles infinite scroll, virtual lists |
| "In the iframe...", "Inside frame..." | `web/frame` | frameLocator chain for nested frames |
| "Upload file", "Attach document" | `web/file-transfer` | setInputFiles or filechooser |
| "Download...", "Export..." | `web/file-transfer` | waitForEvent('download') |
| "Drag...to...", "Move...onto..." | `web/drag-drop` | dragTo first, manual mouse fallback |
| "Accept dialog", "Dismiss alert" | `web/dialog` | Register handler BEFORE trigger |
| "Press Ctrl+S", "Hit Enter" | `web/keyboard` | Shortcuts, tab navigation |
| "In new tab...", "Popup window..." | `web/multi-tab` | waitForEvent('page') pattern |
| "Mock API", "Block requests" | `web/network` | page.route() for interception |
| "API GET/POST/PUT/DELETE:" | `api/request` | Playwright request fixture only |
| "CAPTURE: Response $..." | `api/capture` | Extract from API JSON response |
| "Validate response structure" | `api/validate-schema` | Field existence + type checks |
| "Login..." (SSO) | `auth/sso-login` | Microsoft SSO, OAuth, SAML |
| "Login..." (form) | `auth/basic-login` | Username/password form |
| "Save auth state" | `auth/storage-state` | storageState save/restore |
| "SHARED_DATA:", "Load data" | `data/shared-data` or `data/load` | JSON, CSV |
| "DATASETS:" | `data/load` | Parameterized loop data |
| "Tap...", "Swipe..." (mobile) | `mobile/interact` | Native mobile interactions |
| "Check accessibility" | `a11y/axe-audit` | WCAG compliance audit |

---

## Web Skills (Domain: Browser UI Testing)

| Skill | File | Description |
|-------|------|-------------|
| web/navigate | `skills/web/navigate.skill.md` | Navigate to URL, handle redirects, wait for load |
| web/interact | `skills/web/interact.skill.md` | Click, fill, select, hover, check, press, dblclick, clear |
| web/verify | `skills/web/verify.skill.md` | Assert: text, visible, hidden, count, attribute, URL, enabled, class |
| web/wait | `skills/web/wait.skill.md` | Wait: selector, URL, loadState, networkIdle, response, function |
| web/extract | `skills/web/extract.skill.md` | Read text, attribute, count, value, visibility from elements |
| web/scroll | `skills/web/scroll.skill.md` | Scroll to element, bottom, top; infinite scroll; virtual lists |
| web/frame | `skills/web/frame.skill.md` | iframe/frame handling with frameLocator; nested frames |
| web/file-transfer | `skills/web/file-transfer.skill.md` | File upload (setInputFiles, filechooser) and download |
| web/drag-drop | `skills/web/drag-drop.skill.md` | Drag and drop with dragTo or manual mouse events |
| web/dialog | `skills/web/dialog.skill.md` | Browser dialog handling (alert, confirm, prompt, beforeunload) |
| web/keyboard | `skills/web/keyboard.skill.md` | Keyboard shortcuts, Enter, Escape, Tab, modifier keys |
| web/multi-tab | `skills/web/multi-tab.skill.md` | Multi-tab/popup handling, OAuth popups, new window |
| web/network | `skills/web/network.skill.md` | Network interception, API mocking, request blocking |

## API Skills (Domain: REST API Testing)

| Skill | File | Description |
|-------|------|-------------|
| api/request | `skills/api/request.skill.md` | HTTP request (GET/POST/PUT/PATCH/DELETE) via Playwright request |
| api/capture | `skills/api/capture.skill.md` | Extract values from API responses (JSONPath) |
| api/validate-schema | `skills/api/validate-schema.skill.md` | Validate response body structure and types |

## Auth Skills (Domain: Authentication)

| Skill | File | Description |
|-------|------|-------------|
| auth/sso-login | `skills/auth/sso-login.skill.md` | Microsoft SSO, OAuth, SAML flows |
| auth/basic-login | `skills/auth/basic-login.skill.md` | Username/password form login |
| auth/storage-state | `skills/auth/storage-state.skill.md` | Save/restore browser auth state for session reuse |

## Data Skills (Domain: Test Data Management)

| Skill | File | Description |
|-------|------|-------------|
| data/load | `skills/data/load.skill.md` | Load test data from JSON or CSV files |
| data/shared-data | `skills/data/shared-data.skill.md` | Load cross-scenario shared data (immutable) |

## Mobile Skills (Domain: Native Mobile App Testing)

| Skill | File | Description |
|-------|------|-------------|
| mobile/navigate | `skills/mobile/shared/navigate.skill.md` | Launch app, deep links, back, context switching (native↔webview) |
| mobile/interact | `skills/mobile/shared/interact.skill.md` | Tap, type, swipe, scroll, long press, pinch/zoom |
| mobile/verify | `skills/mobile/shared/verify.skill.md` | Assert: displayed, text, enabled, selected, attribute |
| mobile/app-management | `skills/mobile/shared/app-management.skill.md` | Install, terminate, background, reset, permission handling |
| mobile/android | `skills/mobile/android/android-specific.skill.md` | Android UiAutomator2 selectors, notifications, key codes |
| mobile/ios | `skills/mobile/ios/ios-specific.skill.md` | iOS class chain/predicate selectors, Face ID, alerts |

## Accessibility Skills (Domain: WCAG Compliance)

| Skill | File | Description |
|-------|------|-------------|
| a11y/axe-audit | `skills/a11y/axe-audit.skill.md` | Run axe-core audit (WCAG 2.0/2.1 AA), report violations |
| a11y/aria-check | `skills/a11y/aria-check.skill.md` | Verify ARIA roles, labels, keyboard navigation |

---

## Skill Set by Test Type

**MANDATORY: Activate ONLY the skills for the scenario type. DO NOT use web skills for API-only scenarios. DO NOT use mobile skills for web scenarios.**

| Type | Active Skills |
|------|---------------|
| web | web/*, auth/*, data/*, a11y/* |
| api | api/*, data/* |
| hybrid | web/*, api/*, auth/*, data/*, a11y/* |
| mobile | mobile/*, auth/*, data/* |
| mobile-hybrid | mobile/*, api/*, auth/*, data/* |

---

## Adding a New Skill

1. Create `skills/{domain}/{name}.skill.md` following the template below
2. Add a row to the appropriate domain table in this registry
3. Add an entry to the Quick Decision Guide
4. Update the Skill Set table if type-specific
5. Run `node scripts/rehash-skills.js` to update content hashes

### Skill File Template — MANDATORY Structure

```markdown
# Skill: {domain}/{name}

## Input
- **paramName** (type, required/optional): Description

## Output
- **paramName** (type): Description

## Rules — MUST Follow
- [MUST/NEVER rules with clear rationale]

## Behavior
1. Step-by-step instructions
2. With MUST/MUST NOT directives

## Known Patterns (from app-context)
- Enterprise-specific quirks discovered during exploration

## Code Patterns
\`\`\`typescript
// Example code the Explorer-Builder MUST generate
\`\`\`
```
