# Scenario: [Clear Business Flow Name]

## Metadata
- **Module:** [Feature/Module Name]
- **Priority:** [P0 | P1 | P2 | P3]
- **Type:** [web | api | hybrid | mobile | mobile-hybrid]
- **Tags:** [smoke, regression, P0, module-name, etc.]
- **Depends On:** [None | other-scenario-name (needs: value-name)]
- **Produces:** [None | value-name (saved to shared-state)]

## Application
- **URL:** {{ENV.BASE_URL}}
- **Credentials:** {{ENV.TEST_USERNAME}} / {{ENV.TEST_PASSWORD}}

<!-- For API and Hybrid scenarios, add: -->
<!-- - **API Base URL:** {{ENV.API_BASE_URL}} -->
<!-- - **API Auth:** Bearer {{ENV.API_TOKEN}} -->

## API Behavior
<!-- Required for api and hybrid types. Controls CRUD persistence guardrails. -->
<!-- API Behavior: live -->
<!-- 'live' or omitted = ALL persistence guardrails enforced (POST→GET must find resource) -->
<!-- 'mock' = API is non-persistent, agents may adapt for non-persistence -->

## Pre-conditions
- [Application accessible at {{ENV.BASE_URL}}]
- [Test user credentials valid]
- [If depends on another scenario: Read {{valueName}} from shared-state.json]

## Common Setup Once
<!-- Optional: Runs ONCE before all scenarios — test.beforeAll({ browser }) -->
<!-- Fixture: { browser } ONLY — no page or request -->
1. [Setup step that runs once — e.g., seed test data via API]

## Common Setup
<!-- Optional: Runs before EACH scenario — test.beforeEach({ page }) -->
1. Navigate to {{ENV.BASE_URL}}
2. Login with {{ENV.TEST_USERNAME}} / {{ENV.TEST_PASSWORD}}

---

### Scenario: [name]
**Tags:** [tags for this scenario]

## Steps

### Available Keywords:
<!-- VERIFY:       Hard assertion (stops on failure) — VERIFY: Cart badge shows "2" -->
<!-- VERIFY_SOFT:  Soft assertion (continues on failure) — VERIFY_SOFT: All prices match -->
<!-- CAPTURE:      Read value from UI/API — CAPTURE: Read subtotal as {{subtotal}} -->
<!-- CALCULATE:    Math on captured values — CALCULATE: {{total}} = {{sub}} + {{tax}} -->
<!-- SCREENSHOT:   Visual evidence — SCREENSHOT: checkout-overview -->
<!-- REPORT:       Include in test output — REPORT: Print {{orderNumber}} -->
<!-- SAVE:         Persist for other scenarios — SAVE: {{id}} to shared-state as "key" -->
<!-- SHARED_DATA:  Load shared data — SHARED_DATA: users, products -->
<!-- USE_HELPER:   Call team helper — USE_HELPER: CartPage.calculateTotal -> {{total}} -->
<!-- API verbs:    API GET/POST/PUT/PATCH/DELETE: /endpoint with body {...} -->
<!-- ENV vars:     {{ENV.VARIABLE}} for environment variables -->
<!-- Captured:     {{variableName}} for runtime values from CAPTURE -->

1. Navigate to {{ENV.BASE_URL}}
2. Login with {{ENV.TEST_USERNAME}} / {{ENV.TEST_PASSWORD}}
3. VERIFY: Dashboard is visible
4. [Action step]
5. VERIFY: [Expected state or value]
6. CAPTURE: Read [element value] as {{variableName}}
7. CALCULATE: {{result}} = {{value1}} + {{value2}}
8. SCREENSHOT: [descriptive-name]
9. REPORT: Print {{variableName}}
10. SAVE: {{variableName}} to shared-state as "keyName"

---

<!-- For multi-scenario files, add more ### Scenario: blocks separated by --- -->
<!-- ### Scenario: [second scenario name] -->
<!-- **Tags:** [tags] -->
<!-- 1. [Steps for second scenario] -->

## Common Teardown
<!-- Optional: Runs after EACH scenario — test.afterEach({ page }) -->
1. [Cleanup step — e.g., clear cart, logout]

## Common Teardown Once
<!-- Optional: Runs ONCE after all scenarios — test.afterAll({ browser }) -->
<!-- Fixture: { browser } ONLY — no page or request -->
1. [Final cleanup — e.g., delete seeded data via API]

## SHARED_DATA
<!-- Optional: List shared datasets to load and merge with scenario data -->
<!-- SHARED_DATA: users, products -->

## Test Data
| Field | Value | Notes |
|-------|-------|-------|
| username | {{ENV.TEST_USERNAME}} | From environment |
| password | {{ENV.TEST_PASSWORD}} | From environment |

## DATASETS
<!-- Optional: Data-driven parameterized tests. Explorer explores first row only. -->
<!-- | username        | password      | expectedResult | -->
<!-- |-----------------|---------------|----------------| -->
<!-- | standard_user   | secret_sauce  | success        | -->
<!-- | locked_out_user | secret_sauce  | error          | -->

## Notes for Explorer
- [Popups, iframes, slow-loading pages, dynamic elements]
- [Known UI quirks — custom dropdowns, SVG icons, async grids]
- [For API scenarios: no browser exploration needed]
- [For Hybrid: API steps use request fixture, UI steps use browser]
- [For Mobile: specify platform (Android/iOS) and app package/bundle ID]
