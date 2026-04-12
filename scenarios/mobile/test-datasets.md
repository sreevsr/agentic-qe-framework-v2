# Scenario: Verify Mobile DATASETS Pattern

## Metadata
- **Module:** Framework — Mobile Feature Parity
- **Priority:** P2
- **Type:** mobile
- **Platform:** android
- **Tags:** mobile, framework, parity, datasets, P2

## Application
- **App Package (Android):** {{ENV.APP_PACKAGE}}
- **Device:** {{ENV.ANDROID_DEVICE}}

## Pre-conditions
- Reference Android app on device
- Appium server running

## Purpose
Prove that DATASETS in a mobile scenario produce one independent `it()` block per row, that each row's identifying field appears in the test name, and that all rows actually run (Mocha discovers them at file load).

## DATASETS
| caseId | label             | expectedVisible |
|--------|-------------------|-----------------|
| ds-1   | first-data-row    | true            |
| ds-2   | second-data-row   | true            |
| ds-3   | third-data-row    | true            |

### Scenario: Data-driven launch verification
1. Launch the app
2. VERIFY: The app's main screen is displayed
3. CAPTURE: Read the current Activity name as {{currentActivity}}
4. REPORT: "Row {{caseId}} ({{label}}) — activity {{currentActivity}}"
5. SCREENSHOT: dataset-{{caseId}}

## Notes for Builder
- The `for (const data of testData) { it(...) }` loop MUST be inside `describe()` and OUTSIDE any `it()`
- Test data file lives at `output/test-data/mobile/test-datasets-datasets.json`
- The `it()` title MUST include `data.caseId` and `data.label` so the spec reporter shows three distinct test names
- Tags appear inside the title string (`@regression`), not as a Mocha option

## Verification Criteria
- WDIO spec reporter shows three distinct test names containing `ds-1`, `ds-2`, `ds-3`
- Three screenshot files: `dataset-ds-1.png`, `dataset-ds-2.png`, `dataset-ds-3.png`
- All three tests pass
- Each test contains the same five `// Step N — ...` comment markers
