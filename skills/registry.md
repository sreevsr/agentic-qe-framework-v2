# Skills Registry

Authoritative index of all available skills. The Explorer-Builder reads this to know what capabilities are available.

**Three-level progressive disclosure:**
- **Level 1 (this file):** ~50 tokens per skill, always loaded
- **Level 2 (*.skill.md):** Full instructions, loaded on activation
- **Level 3 (app-context):** Resources, loaded on demand

---

## Web Skills

| Skill | File | Description | Input | Output |
|-------|------|-------------|-------|--------|
| web/navigate | `skills/web/navigate.skill.md` | Navigate to URL, handle redirects, wait for load | url, waitUntil | finalUrl, pageTitle |
| web/interact | `skills/web/interact.skill.md` | Click, fill, select, hover, drag, press keys | action, selector, value | success, method |
| web/verify | `skills/web/verify.skill.md` | Assert element state: text, visibility, count, URL | assertion, expected, soft | passed, actual |
| web/wait | `skills/web/wait.skill.md` | Wait for selector, URL, load state, network, function | strategy, condition | waited, durationMs |
| web/extract | `skills/web/extract.skill.md` | Read text, attribute, count from elements | selector, property | value |

## API Skills

| Skill | File | Description | Input | Output |
|-------|------|-------------|-------|--------|
| api/request | `skills/api/request.skill.md` | HTTP request via Playwright request fixture | method, url, body | status, responseBody |
| api/capture | `skills/api/capture.skill.md` | Extract values from API responses (JSONPath) | response, jsonPath | capturedValue |
| api/validate-schema | `skills/api/validate-schema.skill.md` | Validate response against expected structure | response, schema | valid, errors |

## Auth Skills

| Skill | File | Description | Input | Output |
|-------|------|-------------|-------|--------|
| auth/sso-login | `skills/auth/sso-login.skill.md` | Microsoft SSO, OAuth, SAML flows | provider, email, password | authenticated, storageStatePath |
| auth/basic-login | `skills/auth/basic-login.skill.md` | Username/password form login | selectors, credentials | authenticated |
| auth/storage-state | `skills/auth/storage-state.skill.md` | Save/restore browser auth state | action, path | statePath |

## Data Skills

| Skill | File | Description | Input | Output |
|-------|------|-------------|-------|--------|
| data/load | `skills/data/load.skill.md` | Load from JSON, Excel, CSV | filePath, format | data, recordCount |
| data/shared-data | `skills/data/shared-data.skill.md` | Load cross-scenario shared data | datasetNames | mergedData |

## Mobile Skills [FUTURE]

| Skill | File | Description | Input | Output |
|-------|------|-------------|-------|--------|
| mobile/appium | `skills/mobile/appium.skill.md` | [FUTURE] Native mobile via Appium MCP | action, selector | result |

---

## Skill Set by Test Type

| Type | Active Skills |
|------|---------------|
| web | web/*, auth/*, data/* |
| api | api/*, data/* |
| hybrid | web/*, api/*, auth/*, data/* |
| mobile | mobile/*, auth/*, data/* [FUTURE] |

---

## Adding a New Skill

1. Create `skills/{domain}/{name}.skill.md` with Input/Output/Behavior/Code Patterns sections
2. Add row to the domain table above
3. Update Skill Set table if type-specific
4. Run `node scripts/rehash-skills.js`
