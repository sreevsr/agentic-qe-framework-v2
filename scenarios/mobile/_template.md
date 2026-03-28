# Scenario: [Mobile Scenario Name]

## Metadata
- **Module:** [Feature/Module Name]
- **Priority:** [P0 | P1 | P2]
- **Type:** mobile
- **Platform:** [android | ios | both]
- **Tags:** [mobile, smoke, regression, P0, etc.]

## Application
- **App Package (Android):** {{ENV.ANDROID_APP_PACKAGE}}
- **App Activity (Android):** {{ENV.ANDROID_APP_ACTIVITY}}
- **Bundle ID (iOS):** {{ENV.IOS_BUNDLE_ID}}
- **Device:** {{ENV.DEVICE_NAME}}

## Pre-conditions
- App installed on device/emulator/simulator
- Device is connected and accessible
- Appium server running (or Appium MCP configured)

## Steps
<!-- Mobile action keywords: Tap, Swipe, Long Press, Type, Launch, Navigate Back -->
<!-- Use accessibility labels for element references when possible -->
1. Launch the app
2. Tap "Allow" on permission dialog (if appears)
3. Type {{ENV.TEST_USERNAME}} in the email field
4. Type {{ENV.TEST_PASSWORD}} in the password field
5. Tap Sign In
6. VERIFY: Dashboard screen is displayed
7. Swipe up to scroll to the Reports section
8. Tap on first report item
9. VERIFY: Report detail screen shows correct data
10. SCREENSHOT: report-detail
11. Navigate back
12. VERIFY: Dashboard screen is displayed

## Test Data
| Field | Value | Notes |
|-------|-------|-------|
| username | {{ENV.TEST_USERNAME}} | From environment |
| password | {{ENV.TEST_PASSWORD}} | From environment |

## Notes for Explorer-Builder
- Mobile tests use Appium MCP for device interaction
- Keyboard MUST be dismissed after typing (may block next element)
- Permission dialogs (camera, location, notifications) may appear on first launch
- For WebView screens, context switching (NATIVE_APP ↔ WEBVIEW) is needed
- Specify platform (Android/iOS) — selector strategies differ between platforms
