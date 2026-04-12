# App-Context: Flipkart Android

**App Package:** com.flipkart.android
**Platform:** Android (UiAutomator2Driver)
**Last Updated:** April 10, 2025
**Discovery Run:** flipkart-add-to-cart (FULL mode, 43 steps)
**Device Tested:** 720×1600 resolution Android device

---

## Pattern 1: Top Navigation Tabs — Coordinate Taps Required

**Context:** The 4 top navigation tabs (Flipkart, Minutes, Travel, Grocery) at the top of the home screen.

**Discovery:** These tabs are image-based React Native elements. They have NO accessibility text, resource-id, content-desc, or UiAutomator-reachable attributes. Attempting to locate them by text, id, or description returns 0 elements.

**Solution:** Use coordinate taps only. On 720×1600 device:
- Flipkart tab: (105, 144)
- Minutes tab: (275, 144)
- Travel tab: (445, 144)
- Grocery tab: (615, 144)

**VERIFY strategy:** Take screenshot and confirm visual tab state, OR check that expected content appears after tap (e.g., flight search UI after Travel tab tap).

---

## Pattern 2: Minutes Tab — Live Countdown Timer (Never Match by Text)

**Context:** The Minutes tab at the top of the Flipkart home screen.

**Discovery:** The Minutes tab displays a live countdown timer as its content-desc (e.g., "15", "14", "13"). This value changes every second and is not stable across test runs or even within a single test run.

**Solution:** Use coordinate tap (275, 144) ONLY. NEVER use text(), description(), or content-desc matching for the Minutes tab.

---

## Pattern 3: Search Box — Rotating Placeholder, Use Coordinate + XPath

**Context:** The main search box on the Flipkart home screen.

**Discovery:** The search box placeholder text rotates through different categories (e.g., "watches", "mobiles", "shoes") on each render cycle. Cannot be found by text or content-desc.

**Solution:**
1. Tap the search box by coordinate: (360, 340)
2. After tap, locate the active EditText by XPath: `//android.widget.EditText`
3. Use `sendKeys()` or `setValue()` on the EditText to type the search query
4. Keyboard will appear automatically — do NOT dismiss keyboard before tapping suggestion

---

## Pattern 4: Search Suggestions — Words May Be Reordered

**Context:** The search suggestion list that appears while typing in the search box.

**Discovery:** Flipkart's search suggestions may reorder the words from the typed query. Example: typing "height adjustable computer table" produces suggestion "computer table height adjustable".

**Solution:** Use `textContains()` with a distinctive shorter phrase rather than exact text matching. Alternatively, tap the first suggestion in the list if it contains the expected keywords regardless of order.

---

## Pattern 5: Grocery Tab — Promo Popup May Appear

**Context:** Tapping the Grocery (XtraSaver) tab on the home screen.

**Discovery:** Tapping the Grocery tab sometimes triggers a promotional popup or overlay (e.g., "XtraSaver" promo banner) before the grocery product listing is visible. If a popup appears, the grocery listing content is blocked.

**Solution:** After tapping the Grocery tab (615, 144), check if a popup is present. If so, press BACK key (keycode 4) to dismiss it. The grocery listing OR the dismissal confirmation then becomes visible.

---

## Pattern 6: "Buy at" Button Triggers Upsell Sheet

**Context:** The "Buy at ₹{price}" CTA button on the Product Detail Screen.

**Discovery:** Tapping the "Buy at" button does NOT navigate directly to address selection. Instead, it always shows a "Frequently Bought Together" bottom sheet with an upsell for add-on products (e.g., furniture protection plan). This sheet must be dismissed before checkout continues.

**Solution:**
1. Tap "Buy at" button via `descriptionContains("Buy at")` or coordinate (550, 1460)
2. Wait for "SKIP & CONTINUE" button to appear: `UiSelector().text("SKIP & CONTINUE")`
3. Tap "SKIP & CONTINUE" to dismiss the sheet and proceed to Order Summary

**Note:** Coordinates for "Buy at" button: approximate (550, 1460) on 720×1600 — may shift if product header height changes. Use `descriptionContains("Buy at")` as primary.

---

## Pattern 7: Address Selection Skipped When Default HOME Address Configured

**Context:** The checkout flow after dismissing the upsell sheet.

**Discovery:** When the Flipkart account has a default HOME address configured, the app skips the "Choose a Delivery Address" screen entirely and navigates directly to the "Order Summary" screen (Step 2 of 3 in checkout). The back-navigation stack does NOT include an address selection screen.

**Implication for back navigation:** Pressing BACK from Order Summary goes to the search results (or previous browsing screen), NOT to an address selection screen. Scenario steps describing navigation "back to address screen" will not find that screen — navigate back through the existing stack.

**Solution:** Check for `title_action_bar` text = "Order Summary" after SKIP & CONTINUE. If Order Summary found, address was auto-selected. Capture delivery address from Order Summary screen directly without tapping from an address list.

---

## Pattern 8: Payments Page Is a WebView (No Native UiAutomator Access)

**Context:** The "Payments" screen (Step 3 of 3 in checkout flow).

**Discovery:** The entire payments page renders inside a WebView (`resource-id="com.flipkart.android:id/webview"`). All payment option buttons, amount labels, and interactive elements are inside the WebView container. UiAutomator2 CANNOT access elements inside the WebView via standard selectors.

**Available strategies to interact with Payments WebView:**
1. **Visual capture only**: Take screenshot and use visual assertion/inspection for payment amount
2. **WebView context switch**: Use `driver.getContextHandles()` → switch to `WEBVIEW_com.flipkart.android` context → use Selenium/JavaScript selectors
3. **Coordinate taps**: Use `appium_tap_by_coordinates` for known button positions (fragile)

**Recommended for totalAmount capture:** Switch to WebView context + `driver.executeScript("return document.querySelector('[data-pay-amount]').textContent")` or similar. Visual screenshot capture is acceptable if exact amount verification is not required.

---

## Pattern 9: Cart "Remove" Button — Immediate Removal, No Confirmation

**Context:** The "Remove" button next to a product in the Flipkart cart screen.

**Discovery:** Tapping the "Remove" button immediately removes the product from cart. No confirmation dialog, bottom sheet, or secondary tap is required. The cart item count badge decrements instantly.

**Solution:** Single tap via `UiSelector().text("Remove")`. Verify removal by checking element absence: `UiSelector().textContains("{productName}")` should not be found after tap.

**Note:** If multiple items exist in the cart and multiple "Remove" buttons appear, scope the tap to the specific product row using `UiSelector().textContains("{productName}").fromParent(...)` or sequential element matching.

---

## Pattern 10: Cart — Two Tab Structure (Flipkart and Minutes/Grocery)

**Context:** The "My Cart" screen in the Flipkart app.

**Discovery:** The cart has two tabs: "Flipkart" tab and "Minutes/Grocery" tab. Each tab shows items purchased from that respective section of the app. Items from the main Flipkart marketplace appear in the Flipkart tab. Items from Minutes delivery or Grocery appear in the other tab. The badge count on each tab reflects the number of items in that section.

**Implication:** When verifying a product purchased from the Flipkart marketplace (e.g., LUKZER desk), assert its presence in the Flipkart tab only. The Flipkart tab is the default active tab when cart opens.

---

## General Appium Patterns for Flipkart Android

| Pattern | Selector Strategy | Notes |
|---------|------------------|-------|
| Screen title verification | `resource-id="com.flipkart.android:id/title_action_bar"` | Stable across all screens; check `.getText()` for screen name |
| Back navigation | `mobile_press_key(key="BACK", keycode=4)` | System back key; do NOT use app back button selectors |
| Scroll down | `appium_scroll(direction="down")` on `UiSelector().scrollable(true).instance(0)` | Standard scroll for most list/feed screens |
| Keyboard dismiss | `appium_mobile_hide_keyboard()` | After text input steps where keyboard blocks next element |
| Content-desc with trailing space | `UiSelector().description("Label ")` | Some Flipkart buttons have trailing spaces in content-desc |
| Price text extraction | `UiSelector().text("₹{price}")` | Prices include ₹ symbol and commas (e.g., "₹18,979") |
