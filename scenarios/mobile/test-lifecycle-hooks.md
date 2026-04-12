# Scenario: Verify Mocha Lifecycle Hook Mapping

## Metadata
- **Module:** Framework — Mobile Feature Parity
- **Priority:** P0
- **Type:** mobile
- **Platform:** android
- **Tags:** mobile, framework, parity, lifecycle, P0

## Application
- **App Package (Android):** {{ENV.APP_PACKAGE}}
- **App Activity (Android):** {{ENV.APP_ACTIVITY}}
- **Device:** {{ENV.ANDROID_DEVICE}}

## Pre-conditions
- Any installable Android app on the connected device. SpeedTest is the framework reference app and works for this verification.
- Appium server running (localhost:4723)

## Purpose
This is a framework verification scenario, not a product test. It exists to prove that all four mobile lifecycle sections — `Common Setup Once`, `Common Setup`, `Common Teardown`, `Common Teardown Once` — produce the correct Mocha hooks (`before`, `beforeEach`, `afterEach`, `after`) and that they fire in the expected order.

## Common Setup Once
1. Launch the app
2. REPORT: "before() fired — runs ONCE before all scenarios"

## Common Setup
1. Force-stop and relaunch the app to a clean state
2. REPORT: "beforeEach() fired — runs before every scenario"

## Common Teardown
1. Take a screenshot named "after-each-evidence"
2. REPORT: "afterEach() fired — runs after every scenario"

## Common Teardown Once
1. REPORT: "after() fired — runs ONCE after all scenarios"

### Scenario: First test exercises the hooks
1. VERIFY: The app's main screen is displayed
2. SCREENSHOT: lifecycle-test-1

### Scenario: Second test confirms beforeEach/afterEach run between tests
1. VERIFY: The app's main screen is displayed (proves beforeEach relaunched cleanly)
2. SCREENSHOT: lifecycle-test-2

## Notes for Explorer
- The "main screen" element should be a stable, structural anchor — accessibility_id or resource-id, NEVER hardcoded text.
- If using SpeedTest, the GO button is a reliable main-screen marker.

## Notes for Builder
- Use `before()`, `beforeEach()`, `afterEach()`, `after()` Mocha hooks
- The `softAssertions` pattern is NOT required here
- Do NOT destructure `browser` — it is a WDIO global

## Verification Criteria
- WDIO log output shows hook firing order: `before` → `beforeEach` → test 1 → `afterEach` → `beforeEach` → test 2 → `afterEach` → `after`
- Two `// Step N — ...` comment markers per `it()` block (matching the scenario)
- `before` and `after` produce ONE pair of REPORT messages each across the whole run
