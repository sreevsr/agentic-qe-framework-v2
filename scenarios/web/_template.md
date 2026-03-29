# Scenario: [Web Scenario Name]

## Metadata
- **Module:** [Feature/Module Name]
- **Priority:** [P0 | P1 | P2]
- **Type:** web
- **Tags:** [smoke, regression, P0, etc.]

## Application
- **URL:** {{ENV.BASE_URL}}
- **Credentials:** {{ENV.TEST_USERNAME}} / {{ENV.TEST_PASSWORD}}

## Pre-conditions
- Application accessible at {{ENV.BASE_URL}}
- Test user credentials valid

## Steps
1. Navigate to {{ENV.BASE_URL}}
2. Login with {{ENV.TEST_USERNAME}} / {{ENV.TEST_PASSWORD}}
3. VERIFY: [Page/element is visible after login]
4. SCREENSHOT: after-login
5. [Action step — click, fill, select, navigate]
6. VERIFY: [Expected state after action]
7. CAPTURE: Read [value] as {{variableName}}
8. SCREENSHOT: [descriptive-name]

## Test Data
| Field | Value | Notes |
|-------|-------|-------|
| username | {{ENV.TEST_USERNAME}} | From environment |

## Notes for Explorer
- The Explorer opens a live browser to verify each step
- Selectors are discovered automatically — no need to specify CSS/XPath
- Use VERIFY for assertions that MUST pass, VERIFY_SOFT for non-blocking checks
- If the app has popups, iframes, or slow-loading components, note them here
