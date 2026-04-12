# Scenario: Verify Mobile SHARED_DATA + SAVE/loadState

## Metadata
- **Module:** Framework — Mobile Feature Parity
- **Priority:** P2
- **Type:** mobile
- **Platform:** android
- **Tags:** mobile, framework, parity, shared-data, save, P2

## Application
- **App Package (Android):** {{ENV.APP_PACKAGE}}
- **Device:** {{ENV.ANDROID_DEVICE}}

## Pre-conditions
- Reference Android app on device
- Appium server running
- `output/test-data/shared/mobile-users.json` exists with at least one user object
- `output/test-data/mobile/test-shared-data.json` exists with scenario-specific test data

## SHARED_DATA: mobile-users

## Purpose
Prove that:
1. `loadTestData('mobile/test-shared-data', ['mobile-users'])` works in a mobile spec — the helper is plain TypeScript with no Playwright dependency
2. `SAVE` from one scenario writes to `shared-state.json`
3. A second scenario can read the saved value back via `loadState`
4. `core/shared-state.ts` and `core/test-data-loader.ts` work unchanged in WDIO/Mocha

### Scenario: Save a value
1. Launch the app
2. CAPTURE: The current device timestamp as {{savedTimestamp}}
3. SAVE: {{savedTimestamp}} to shared-state.json as "lastMobileRunTimestamp"
4. REPORT: "Saved timestamp {{savedTimestamp}}"

### Scenario: Load the value saved above
1. Launch the app
2. CAPTURE: loadState("lastMobileRunTimestamp") as {{loadedTimestamp}}
3. VERIFY: {{loadedTimestamp}} is not empty
4. REPORT: "Loaded timestamp {{loadedTimestamp}} from previous scenario"

## Notes for Builder
- Import `loadTestData` from `../../../core/test-data-loader` (relative path traverses three levels up from a mobile spec)
- Import `saveState` and `loadState` from `../../../core/shared-state`
- The SHARED_DATA section above merges `output/test-data/shared/mobile-users.json` into `testData`
- Both scenarios share the same `describe()` block — Mocha runs them sequentially in declaration order

## Verification Criteria
- Both scenarios pass
- After the run, `output/shared-state.json` contains a `lastMobileRunTimestamp` key
- Scenario 2's REPORT log line shows the same timestamp that Scenario 1 saved
- The spec imports `loadTestData` from `core/test-data-loader` (not a direct JSON import)
