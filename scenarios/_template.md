# Scenario: [Scenario Name]

## Metadata
- **Module:** [Feature/Module Name]
- **Priority:** [P0 | P1 | P2]
- **Type:** [web | api | hybrid]
- **Tags:** [smoke, regression, P0, etc.]
- **Depends On:** [Other scenarios, if any]
- **Produces:** [Shared data or state this scenario creates]

## Application
- **URL:** {{ENV.BASE_URL}}
- **Credentials:** {{ENV.TEST_USERNAME}} / {{ENV.TEST_PASSWORD}}

## Pre-conditions
- [List any preconditions]

## Common Setup Once
<!-- Optional: test.beforeAll — fixture: { browser } only -->
1. [Setup step that runs once]

## Common Setup
<!-- Optional: test.beforeEach -->
1. Navigate to {{ENV.BASE_URL}}
2. Login with {{ENV.TEST_USERNAME}}

## Steps
<!-- Keywords: VERIFY, VERIFY_SOFT, CAPTURE, CALCULATE, SCREENSHOT, REPORT, SAVE -->
<!-- Variables: {{ENV.VARIABLE}} for env vars, {{captured}} for runtime values -->
1. [Action step]
2. VERIFY: [Expected state or value]
3. CAPTURE: [Value] as {{variableName}}
4. SCREENSHOT: [description]

## Common Teardown
<!-- Optional: test.afterEach -->
1. [Cleanup step]

## Common Teardown Once
<!-- Optional: test.afterAll — fixture: { browser } only -->
1. [Final cleanup step]

## Test Data
| Field | Value | Notes |
|-------|-------|-------|
| username | {{ENV.TEST_USERNAME}} | From environment |

## DATASETS
<!-- Optional: data-driven parameterized tests -->
<!-- | column1 | column2 | expectedResult | -->

## SHARED_DATA
<!-- Optional: SHARED_DATA: users, products -->

## Notes
- [Any context for the Explorer-Builder agent]
