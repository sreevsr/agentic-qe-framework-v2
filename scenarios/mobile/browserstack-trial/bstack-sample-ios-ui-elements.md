# Scenario: BStack Sample iOS — UI Elements, Alert, and Web View tab

## Metadata
- **Module:** BrowserStack Sample iOS (UI showcase app)
- **Priority:** P0
- **Type:** mobile
- **Platform:** ios
- **Tags:** mobile, ios-only, P0, cloud, browserstack-trial

## Application
- **Bundle ID (iOS):** com.browserstack.Sample-iOS
- **iOS app URL:** bs://f747990bd1500d16a845460128e4f151bdc02c0d
- **Device:** iPhone 14 / iOS 16 (BrowserStack App Automate)
- **App description:** BrowserStack's "Sample iOS" — a UI component showcase with a UI Elements tab (Text button + Alert button), a Web View tab, and a Local Testing tab.

## Pre-conditions
- BrowserStack App Automate session reserved (1 parallel on free trial)
- `BROWSERSTACK_USERNAME`, `BROWSERSTACK_ACCESS_KEY`, `BROWSERSTACK_IOS_APP_URL` env vars set
- WDIO runs with `wdio.browserstack.conf.ts` (iPhone 14 / iOS 16 capability)

## Steps
1. Launch the app — VERIFY: UI Elements screen is visible (navigation bar title "UI Elements" and tab bar with three tabs: UI Elements, Web View, Local Testing)
2. VERIFY: "Text" button is visible on the UI Elements screen
3. VERIFY: "Alert" button is visible on the UI Elements screen
4. Tap the "Alert" button
5. VERIFY: a native iOS alert appears
6. CAPTURE: the alert title into variable `alertTitle`
7. REPORT: `alertTitle`
8. Accept / dismiss the alert (tap its default OK button)
9. VERIFY: the alert is no longer visible
10. Tap the "Web View" tab in the bottom tab bar
11. VERIFY: Web View screen is visible (navigation title "Web View" or equivalent stable identifier)
12. SCREENSHOT: `web-view-tab-loaded`
13. Tap the "UI Elements" tab to return
14. VERIFY: UI Elements screen is visible again (Text button and Alert button re-visible)

## Test Data
_No test data required — scenario is fully static, no user input or credentials._

## Notes for Explorer
- **First real iOS scenario on this framework** — every locator must be verified against live `get_page_source`, NOT guessed.
- iOS locator strategy priority (per MobileLocatorLoader): `accessibility id` → `name` → `iOS class chain` → `iOS predicate string` → `xpath` (last resort).
- From initial page source (captured 2026-04-14 during Explorer walkthrough):
  - App bundle ID: `com.browserstack.Sample-iOS`
  - Nav bar title: `"UI Elements"` (XCUIElementTypeStaticText, `name="UI Elements"`, trait="Header")
  - "Text" button: `XCUIElementTypeButton`, `name="Text Button"`, `label="Text"` → iOS accessibility id is `"Text Button"`
  - "Alert" button: `XCUIElementTypeButton`, `name="Alert"`, `label="Alert"` → iOS accessibility id is `"Alert"`
  - Tab bar: `XCUIElementTypeTabBar`, `name="Tab Bar"`, three tab buttons with accessibility ids `"UI Elements"`, `"Web View"`, `"Local Testing"`
- The **Alert button is expected to trigger a native iOS alert** (`XCUIElementTypeAlert`). Native iOS alerts are handled via `driver.getAlertText()` / `driver.acceptAlert()` — NOT the same code path as Android alerts. This exercises iOS-specific alert handling through BaseScreen / Screen Object.
- The UI Elements tab bar button has `traits="Button, Selected"` on load — confirms tab bar uses standard iOS tab controller, same accessibility pattern as any other iOS tab app.
- Do NOT call `waitForActivity` — iOS has no activities. Screen-ready checks should wait on the navigation title's accessibility id.
- App launches via `wdio.browserstack.conf.ts` capabilities — no navigate() call needed.

## Budget note
- ~97 minutes of BrowserStack free trial App Automate remaining as of 2026-04-14.
- Scenario should stay under 60 seconds of runtime body (WDA install overhead ~90-120s is unavoidable).

## Follow-up (Option A — separate scenario, later)
- Re-upload the actual `BStackSampleApp.ipa` (e-commerce app with login + products + cart) and write a second scenario that exercises picker wheels + Add to Cart + cart badge count. That is the original goal and will probe the `selectOption` gap on iOS which this scenario does NOT exercise.
