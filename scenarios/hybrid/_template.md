# Scenario: [Hybrid Scenario Name — UI + API Combined]

## Metadata
- **Module:** [Feature/Module Name]
- **Priority:** [P0 | P1 | P2]
- **Type:** hybrid
- **Tags:** [hybrid, smoke, regression, etc.]

## API Behavior: live
<!-- 'live' = CRUD persistence guardrails enforced -->
<!-- 'mock' = API non-persistent, agents may adapt -->

## Application
- **URL:** {{ENV.BASE_URL}}
- **API Base URL:** {{ENV.API_BASE_URL}}
- **Credentials:** {{ENV.TEST_USERNAME}} / {{ENV.TEST_PASSWORD}}
- **API Auth:** Bearer {{ENV.API_TOKEN}}

## Pre-conditions
- Application UI accessible at {{ENV.BASE_URL}}
- API accessible at {{ENV.API_BASE_URL}}

## Steps

<!-- Hybrid scenarios interleave UI and API steps in phases -->

### Phase 1: API Setup (seed test data)
1. API POST: {{ENV.API_BASE_URL}}/resource with body {"name": "Test Data"}
2. VERIFY: Response status is 201
3. CAPTURE: Response $.id as {{resourceId}}

### Phase 2: UI Flow (use API-created data)
4. Navigate to {{ENV.BASE_URL}}
5. Login with {{ENV.TEST_USERNAME}} / {{ENV.TEST_PASSWORD}}
6. VERIFY: Dashboard is visible
7. Navigate to resource page
8. Search for {{resourceId}}
9. VERIFY: Data created via API is visible in UI
10. SCREENSHOT: resource-visible

### Phase 3: UI Action + API Verification
11. [Perform UI action — e.g., update, complete, delete]
12. VERIFY: UI shows success confirmation
13. API GET: {{ENV.API_BASE_URL}}/resource/{{resourceId}}
14. VERIFY: API reflects the change made via UI

### Phase 4: Cleanup
15. API DELETE: {{ENV.API_BASE_URL}}/resource/{{resourceId}}
16. VERIFY: Response status is 200

## Expected Results
- API-created data is visible and consistent in the UI
- UI actions produce the expected API state changes
- Cross-channel assertions pass (UI state matches API state)

## Test Data
| Field | Value | Notes |
|-------|-------|-------|
| username | {{ENV.TEST_USERNAME}} | For UI login |
| apiToken | {{ENV.API_TOKEN}} | For API steps |

## Notes for Explorer-Builder
- Hybrid tests ALWAYS use BOTH { page, request } fixtures
- The hybrid tag is REQUIRED for CI/CD filtering
- API steps use request fixture (no browser), UI steps use browser
- Variables captured from API (like {{resourceId}}) are shared with UI steps
- Cross-channel VERIFY steps are critical — they ensure UI and API agree
