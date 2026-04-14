# Scenario: BStackSampleApp — Login and add product to cart (iOS cloud)

## Metadata
- **Module:** BStackSampleApp (BrowserStack sample e-commerce demo)
- **Priority:** P0
- **Type:** mobile
- **Platform:** ios
- **Tags:** mobile, ios-only, P0, cloud, browserstack-trial

## Application
- **Bundle ID (iOS):** com.browserstack.BStackSampleApp
- **iOS app URL:** bs://f747990bd1500d16a845460128e4f151bdc02c0d
- **Device:** iPhone 14 / iOS 16 (BrowserStack App Automate)
- **Credentials:** demouser / testingisfun99 (BrowserStack demo account, public)

## Pre-conditions
- BrowserStack App Automate session reserved (1 parallel on free trial)
- `BROWSERSTACK_USERNAME` and `BROWSERSTACK_ACCESS_KEY` env vars set
- `BROWSERSTACK_IOS_APP_URL` env var set to the bs:// URL above
- WDIO runs with `wdio.browserstack.conf.ts` (iPhone 14 / iOS 16 capability)

## Steps
1. Launch the app on the cloud iPhone — VERIFY login screen is visible (Username and Password fields or pickers visible)
2. Tap the Username field, select `demouser` from the picker
3. Tap the Password field, select `testingisfun99` from the picker
4. Tap the `Log In` button
5. VERIFY: product list screen is visible (product cells render, at least one "Add to cart" control present)
6. CAPTURE: name of the first product into variable `firstProductName`
7. Tap the first product's `Add to cart` button
8. VERIFY: cart badge / cart icon count becomes `1`
9. Tap the cart icon to open the cart
10. VERIFY: cart screen shows exactly 1 line item
11. VERIFY: that line item's name matches `firstProductName` (captured in step 6)
12. SCREENSHOT: `cart-with-one-item`

## Test Data
| Field    | Value            | Notes                                  |
|----------|------------------|----------------------------------------|
| username | demouser         | Public BrowserStack demo account       |
| password | testingisfun99   | Public BrowserStack demo account       |

## Notes for Explorer
- First real iOS scenario on this framework — treat carefully. Verify every locator against `get_page_source` on the cloud device, not guessed from the Android equivalent.
- Login fields on iOS are **picker wheels** (UIPickerView), not text inputs. Use `mobile: selectPickerWheelValue` or equivalent iOS pattern — this is the first exercise of a non-text-input selection pattern on iOS, and the Android-only `selectOption` BaseScreen helper is expected to be insufficient. Emit a `USE_HELPER` step + accompanying `*.helpers.ts` if needed.
- iOS locator strategy priority (per MobileLocatorLoader): `accessibility id` → `name` → `iOS class chain` → `iOS predicate string` → `xpath` (last resort).
- BrowserStack WDA session startup is 90–120s of intrinsic overhead. Keep iterations minimal: prefer one long exploration session over many short ones.
- Do NOT call `waitForActivity` — iOS has no activities. If a screen-ready check is needed, wait on a stable element (e.g., the product list header).
- App launches via `wdio.browserstack.conf.ts` capabilities — no navigate() call needed.

## Budget note
- ~97 minutes of BrowserStack free trial App Automate remaining as of 2026-04-14.
- Target < 10 iterations total (< 20 min of trial consumption).
