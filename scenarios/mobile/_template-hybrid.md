# Scenario: [Mobile App + API Scenario Name]

## Metadata
- **Module:** [Feature/Module Name]
- **Priority:** [P0 | P1 | P2]
- **Type:** mobile-hybrid
- **Platform:** [android | ios | both]
- **Tags:** [mobile-hybrid, smoke, P0, etc.]

## API Behavior: live

## Application
- **App Package (Android):** {{ENV.APP_PACKAGE}}
- **App Activity (Android):** {{ENV.APP_ACTIVITY}}
- **Bundle ID (iOS):** {{ENV.IOS_BUNDLE_ID}}
- **Device:** {{ENV.ANDROID_DEVICE}} / {{ENV.IOS_DEVICE}}
- **API Base URL:** {{ENV.API_BASE_URL}}
- **API Auth:** Bearer {{ENV.API_TOKEN}}

## Pre-conditions
- App installed on device
- Appium server running (localhost:4723)
- API server accessible
- Valid API credentials

## Steps

### Phase 1: API Setup
1. API POST: {{ENV.API_BASE_URL}}/resource with body {"name": "Test"}
2. VERIFY: Response status is 201
3. CAPTURE: Response $.id as {{resourceId}}

### Phase 2: Mobile App Verification
4. Launch the app
5. Tap "Allow" on permission dialog (if appears)
6. Type {{ENV.MOBILE_USERNAME}} in email field
7. Tap Sign In
8. VERIFY: Home screen is displayed
9. Search for {{resourceId}}
10. VERIFY: API-created data appears in app

### Phase 3: App Action + API Verification
11. Tap on resource to update status
12. VERIFY: Status updated in app UI
13. API GET: {{ENV.API_BASE_URL}}/resource/{{resourceId}}
14. VERIFY: API reflects app-initiated change

### Phase 4: Cleanup
15. API DELETE: {{ENV.API_BASE_URL}}/resource/{{resourceId}}
16. VERIFY: Response status is 200

## Notes for Explorer
- API steps do NOT use Appium — direct HTTP calls via axios
- Mobile steps use screen objects via Appium
- Cross-channel VERIFY steps confirm API and App state consistency
- CAPTURE variables from API responses are accessible in mobile steps (shared scope)
