# Scenario: [Mobile Scenario Name]

## Metadata
- **Module:** [Feature/Module Name]
- **Priority:** [P0 | P1 | P2]
- **Type:** mobile
- **Platform:** [android | ios | both]
- **Tags:** [mobile, smoke, regression, P0, etc.]

## Application
- **App Package (Android):** {{ENV.APP_PACKAGE}}
- **App Activity (Android):** {{ENV.APP_ACTIVITY}}
- **Bundle ID (iOS):** {{ENV.IOS_BUNDLE_ID}}
- **Device:** {{ENV.ANDROID_DEVICE}} / {{ENV.IOS_DEVICE}}
- **Credentials:** {{ENV.MOBILE_USERNAME}} / {{ENV.MOBILE_PASSWORD}} (if applicable)

## Pre-conditions
- App installed on device/emulator/simulator
- Device is connected and accessible via ADB / Xcode
- Appium server running (localhost:4723)
- [App-specific pre-conditions]

## Steps
<!-- Mobile action keywords: Tap, Swipe, Long Press, Type, Launch, Navigate Back -->
<!-- Use accessibility labels for element references when possible -->
1. Launch the app
2. [Handle permission dialogs / overlays if expected]
3. Tap [element] / Type [text] in [field]
4. VERIFY: [expected screen/element state]
5. SCREENSHOT: [name]

## Test Data
| Field | Value | Notes |
|-------|-------|-------|
| username | {{ENV.MOBILE_USERNAME}} | From environment |

## Notes for Explorer
- [Permission dialogs expected on first launch]
- [Known overlays / banners to dismiss]
- [Element identification hints: resource-id, content-desc, accessibility-id]
- [Timing considerations: animations, network calls, loading spinners]
- Keyboard MUST be dismissed after typing (may block next element)
- Specify platform-specific behavior differences if Platform: both

<!--
KEYWORD REFERENCE (mobile):
  VERIFY          — Assert a condition (becomes expect() assertion via Screen Object)
  CAPTURE         — Store a runtime value (becomes variable assignment via screen.getText())
  SCREENSHOT      — Capture screen screenshot (becomes screen.takeScreenshot('name'))
  REPORT          — Print value to test output (becomes console.log)
  SAVE            — Persist to shared-state.json (becomes saveState() call)
  USE_HELPER      — Call team helper method (requires *.helpers.ts file in output/screens/)
  {{ENV.VAR}}     — Environment variable (becomes process.env.VAR — no fallback defaults)

MOBILE-SPECIFIC RULES:
  - No driver.pause() — use screen.waitForElement() instead
  - No direct browser.$() calls — all interactions via Screen Objects
  - App launch happens via wdio.conf.ts capabilities, not a navigate() call
  - First action in every test MUST be waitForElement() on a stable screen identifier
  - Gestures use W3C Actions API via BaseScreen.swipe() — no deprecated touchAction()
-->
