# Scenario: Verify Mobile VERIFY_SOFT Pattern

## Metadata
- **Module:** Framework — Mobile Feature Parity
- **Priority:** P0
- **Type:** mobile
- **Platform:** android
- **Tags:** mobile, framework, parity, verify-soft, P0

## Application
- **App Package (Android):** {{ENV.APP_PACKAGE}}
- **App Activity (Android):** {{ENV.APP_ACTIVITY}}
- **Device:** {{ENV.ANDROID_DEVICE}}

## Pre-conditions
- A reference Android app (SpeedTest is the default).
- Appium server running.

## Purpose
Prove that the mobile `VERIFY_SOFT` keyword:
1. Generates a `try`/`catch` block + `softAssertions.push(await screen.recordSoftFailure(...))`
2. Continues to subsequent steps even when one VERIFY_SOFT fails
3. Throws at the end of the `it()` block reporting all soft failures
4. Saves a `VERIFY_SOFT-failed-{label}-{ts}.png` screenshot for each failed assertion

### Scenario: All soft assertions pass
1. Launch the app
2. VERIFY_SOFT: The main screen displays the primary action element
3. VERIFY_SOFT: The bottom navigation is visible
4. VERIFY_SOFT: A header/title element is present
5. SCREENSHOT: verify-soft-all-pass

### Scenario: One soft assertion fails — test continues (meta-test)
1. Launch the app
2. VERIFY_SOFT: The main screen displays the primary action element
3. VERIFY_SOFT: A nonexistent element with key "intentionallyMissingElement" is displayed
4. VERIFY_SOFT: The header/title element is still present (this MUST run even though step 3 failed)
5. SCREENSHOT: verify-soft-one-failure
6. REPORT: confirm exactly one soft failure was collected and step 4 ran after step 3 failed

**Note:** This scenario is a META-TEST. The Builder must NOT use the standard `softAssertions[]` + final-throw pattern that would make the test fail at the end. Instead, the spec uses an INNER `innerSoftAssertions[]` array isolated from the outer one, then asserts on the mechanism's behavior (1 inner failure collected, all 3 steps executed). The outer test PASSES when the VERIFY_SOFT mechanism behaves correctly.

## Notes for Builder
- Declare `softAssertions: string[]` at the describe scope
- Reset `softAssertions = []` in `beforeEach`
- Each VERIFY_SOFT step uses `try { expect(...) } catch (err) { softAssertions.push(await screen.recordSoftFailure('label', err)); }`
- The conditional throw `if (softAssertions.length > 0) throw new Error(...)` MUST be the LAST statement of every `it()` that contains any VERIFY_SOFT
- The "intentionallyMissingElement" key must NOT be added to the locator JSON — the failure is the entire point

## Verification Criteria
- Scenario 1 passes with 3 soft assertions, no thrown error
- Scenario 2 fails at the END (not at step 3), with exactly one entry in the soft-assertion report
- One PNG file matching `test-results/screenshots/VERIFY_SOFT-failed-intentionallymissingelement-*.png` exists after the run
