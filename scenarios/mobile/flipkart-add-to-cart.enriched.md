# Scenario: Flipkart — Product Search, Buy Now Navigation, and Cart Verification (Enriched)

## Metadata
- **Module:** Shopping / Cart Management
- **Priority:** P1
- **Type:** mobile
- **Platform:** android
- **Tags:** mobile, regression, P1, shopping, cart, search, flipkart

## Application
- **App Package (Android):** com.flipkart.android
- **App Activity (Android):** com.flipkart.android.MainActivity
- **Bundle ID (iOS):** N/A
- **Device:** {{ENV.ANDROID_DEVICE}} (verified on 720×1600 Android)
- **Credentials:** N/A (user session already active; delivery address pre-saved in account)

## Detail Level: EXPLORER-VERIFIED
Steps verified during live exploration on April 10, 2025 (FULL run — no prior enriched.md).
All 43 steps: DEEP-verified on active Appium session (`284a16a1-744b-4ed4-b27c-b41101fd79d6`, AndroidUiAutomator2Driver).
Element selectors captured from Appium UiAutomator page source. Elements with no accessibility nodes use coordinate fallback.
Screen section headers (not URLs) organize steps — mobile apps use activities/views, not URLs.
ORIGINAL/DISCOVERED tags show provenance.

**Captured Runtime Values:**
- `productName` = "LUKZER Electric Height Adjustable Desk with USB & Type-C Work from Home Table (EST-004) Engineered Wood Office Table"
- `productDescription` = "Electric Height Adjustable Desk with USB & Type-C Work from Home"
- `productPrice` = "₹18,979"
- `discountPercentage` = "68%"
- `confirmedDeliveryAddress` = "Flat no. 203, B Block, Tapovan Saraswathi Apartment, 3rd Stage, Industrial Suburb, Vishweshwar nagar, Near Maharshi Public School, Mysuru 570008"
- `totalAmount` = "₹18,030"

---

## Steps

### FlipkartHomeScreen

1. Wait for the Flipkart home screen to be visible (stable screen identifier: top navigation tabs row) <!-- ORIGINAL -->
   <!-- ELEMENT: {"screen":"FlipkartHomeScreen","key":"homeScreenTabRow","android":{"uiautomator":"new UiSelector().className(\"android.widget.ImageView\").instance(0)"},"type":"structural","description":"Top navigation tabs row — presence confirms home screen is loaded"} -->
   <!-- DISCOVERED: Wait for any of the 4 tab images to be present. The tab row is always visible on the home screen. Use appium_find_element with UiSelector().className("android.widget.ImageView").instance(0) to confirm home screen is loaded. -->

2. VERIFY: The following navigation tabs are displayed at the top of the screen: "Flipkart", "Minutes", "Travel", "Grocery" <!-- ORIGINAL -->
   <!-- ELEMENT: {"screen":"FlipkartHomeScreen","key":"flipkartTab","android":{"coordinate":[105,144]},"type":"tab","description":"Flipkart top nav tab — image-only React Native element, no accessibility node"} -->
   <!-- ELEMENT: {"screen":"FlipkartHomeScreen","key":"minutesTab","android":{"coordinate":[275,144]},"type":"tab","description":"Minutes top nav tab — image-only, content-desc is live countdown timer value"} -->
   <!-- ELEMENT: {"screen":"FlipkartHomeScreen","key":"travelTab","android":{"coordinate":[445,144]},"type":"tab","description":"Travel top nav tab — image-only React Native element"} -->
   <!-- ELEMENT: {"screen":"FlipkartHomeScreen","key":"groceryTab","android":{"coordinate":[615,144]},"type":"tab","description":"Grocery top nav tab — image-only React Native element"} -->
   <!-- DISCOVERED: All 4 top navigation tabs are image-based React Native elements with NO accessible text, resource-id, or UiAutomator-reachable nodes. Verified via page source inspection — tabs render as android.widget.ImageView instances with no content-desc or text attributes. VERIFY by confirming 4 image elements exist in the tab row area (y≈144). Use screenshot-based verification or element count check. Device resolution: 720×1600. -->

3. VERIFY: The delivery address shown at the top of the screen contains "Flat no. 203, B Block, Tapovan Saraswathi Apartment" <!-- ORIGINAL -->
   <!-- ELEMENT: {"screen":"FlipkartHomeScreen","key":"deliveryAddress","android":{"uiautomator":"new UiSelector().textContains(\"Flat no. 203, B Block, Tapovan\")"},"type":"text","description":"Delivery address row below nav tabs — truncated to one line on screen"} -->
   <!-- DISCOVERED: Delivery address is truncated in the UI (shows "Flat no. 203, B Block, Tapovan..."). Use textContains with first 30 characters. Full address: "Flat no. 203, B Block, Tapovan Saraswathi Apartment, 3rd Stage, Industrial Suburb...". -->

4. Tap the "Flipkart" tab at the top <!-- ORIGINAL -->
   <!-- ELEMENT: {"screen":"FlipkartHomeScreen","key":"flipkartTab","android":{"coordinate":[105,144]},"type":"tab","description":"Flipkart top nav tab — coordinate tap, no accessibility node"} -->
   <!-- DISCOVERED: Coordinate tap only. appium_tap_by_coordinates(x=105, y=144). No accessibility node available — confirmed by page source inspection. -->

5. SCREENSHOT: flipkart-tab <!-- ORIGINAL -->

6. Tap the "Minutes" tab at the top <!-- ORIGINAL -->
   <!-- ELEMENT: {"screen":"FlipkartHomeScreen","key":"minutesTab","android":{"coordinate":[275,144]},"type":"tab","description":"Minutes top nav tab — coordinate tap only; content-desc is a live countdown"} -->
   <!-- DISCOVERED: Minutes tab content-desc is a live countdown timer value (e.g., "15", "14") that changes every second. The text/number shown is not stable. NEVER attempt to match by text or content-desc. Coordinate tap (275, 144) is the ONLY reliable strategy. -->

7. SCREENSHOT: minutes-tab <!-- ORIGINAL -->

8. Tap the "Travel" tab at the top <!-- ORIGINAL -->
   <!-- ELEMENT: {"screen":"FlipkartHomeScreen","key":"travelTab","android":{"coordinate":[445,144]},"type":"tab","description":"Travel top nav tab — coordinate tap only"} -->

9. SCREENSHOT: travel-tab <!-- ORIGINAL -->

10. Tap the "Grocery" tab at the top <!-- ORIGINAL -->
    <!-- ELEMENT: {"screen":"FlipkartHomeScreen","key":"groceryTab","android":{"coordinate":[615,144]},"type":"tab","description":"Grocery top nav tab — coordinate tap only; may trigger promo popup"} -->
    <!-- DISCOVERED: Tapping the Grocery tab may show a promotional popup or "XtraSaver" promo overlay. If a popup appears before the grocery listing loads, dismiss it with BACK key, then proceed. The grocery content is visible after popup dismissal. -->

11. SCREENSHOT: grocery-tab <!-- ORIGINAL -->

12. Tap the "Flipkart" tab at the top to return to the main shopping section <!-- ORIGINAL -->
    <!-- ELEMENT: {"screen":"FlipkartHomeScreen","key":"flipkartTab","android":{"coordinate":[105,144]},"type":"tab","description":"Flipkart top nav tab — return to main home feed"} -->
    <!-- DISCOVERED: If a promo popup is visible from Grocery tab, press BACK key first to dismiss it, then tap Flipkart tab at (105, 144). Confirmed navigation to Flipkart home feed after tap. -->

### SearchScreen

13. Tap the search box <!-- ORIGINAL -->
    <!-- ELEMENT: {"screen":"FlipkartHomeScreen","key":"searchBox","android":{"coordinate":[360,340]},"type":"input","description":"Search box in home screen header — tapping focuses and opens search overlay"} -->
    <!-- DISCOVERED: Search box placeholder text rotates (e.g., "watches", "mobiles", etc.) on each render cycle — cannot locate by content-desc or text. Coordinate tap at (360, 340) reliably focuses the search box. After tap, an EditText becomes the active input element. -->

14. Type "height adjustable computer table" in the search box <!-- ORIGINAL -->
    <!-- ELEMENT: {"screen":"SearchScreen","key":"searchInput","android":{"xpath":"//android.widget.EditText"},"type":"input","description":"Active search input field after focus — located by EditText class"} -->
    <!-- DISCOVERED: After tapping the search box, use XPath //android.widget.EditText to locate the active input. Send keys "height adjustable computer table". Keyboard appears automatically. Do NOT hide keyboard before tapping suggestion. -->

15. Tap "height adjustable computer table" from the search suggestions list <!-- ORIGINAL -->
    <!-- ELEMENT: {"screen":"SearchScreen","key":"searchSuggestion","android":{"uiautomator":"new UiSelector().text(\"computer table height adjustable\")"},"type":"listItem","description":"First matching search suggestion — note: app reorders query words in suggestion text"} -->
    <!-- DISCOVERED: The app's search suggestions reorder words from the typed query. Typing "height adjustable computer table" produced suggestion "computer table height adjustable" (words reordered). Tap the suggestion that contains all the query words regardless of order. If the exact suggestion text varies, use textContains("computer table") as fallback. The selected suggestion triggers the search results page load. -->

### SearchResultsScreen

16. REPEAT_UNTIL: A product with "LUKZER" in its name is visible in the search results <!-- ORIGINAL -->
    a. Scroll down in search results
    <!-- ELEMENT: {"screen":"SearchResultsScreen","key":"resultsScrollView","android":{"uiautomator":"new UiSelector().scrollable(true).instance(0)"},"type":"scrollable","description":"Search results list — scroll down to reveal more products"} -->
    <!-- DISCOVERED: LUKZER product appeared after 2 scroll-down gestures. Uses appium_scroll(direction=down) on the scrollable search results container. Check for textContains("LUKZER") after each scroll. Safety limit: 10 scrolls. -->

17. Tap the first visible product in search results whose name contains "LUKZER" <!-- ORIGINAL -->
    <!-- ELEMENT: {"screen":"SearchResultsScreen","key":"lukzerProductCard","android":{"uiautomator":"new UiSelector().textContains(\"LUKZER\")"},"type":"listItem","description":"First LUKZER product card visible in search results grid"} -->
    <!-- DISCOVERED: LUKZER Electric Height Adjustable Desk appears in a sponsored card position. textContains("LUKZER") matched the product name label on the card. After tap, transitions to ProductDetailScreen. -->

### ProductDetailScreen

18. CAPTURE: Full product name displayed below the product photos as {{productName}} <!-- ORIGINAL -->
    <!-- ELEMENT: {"screen":"ProductDetailScreen","key":"productName","android":{"uiautomator":"new UiSelector().textContains(\"LUKZER Electric Height Adjustable\")"},"type":"text","description":"Full product name — positioned below image carousel, requires scroll down to enter viewport"} -->
    <!-- DISCOVERED: productName = "LUKZER Electric Height Adjustable Desk with USB & Type-C Work from Home Table (EST-004) Engineered Wood Office Table". The product name is below the image carousel viewport on load — scroll DOWN once to reveal it before capturing. Brand label "LUKZER" appears separately above the description at bounds [32,438][143,474]. -->

19. CAPTURE: Product description displayed below the product photos as {{productDescription}} <!-- ORIGINAL -->
    <!-- ELEMENT: {"screen":"ProductDetailScreen","key":"productDescription","android":{"uiautomator":"new UiSelector().textContains(\"Electric Height Adjustable Desk with USB\")"},"type":"text","description":"Short product description line below the product name"} -->
    <!-- DISCOVERED: productDescription = "Electric Height Adjustable Desk with USB & Type-C Work from Home". This text appears directly below the full product name at bounds [32,482][688,554]. -->

20. REPORT: Print {{productName}} and {{productDescription}} <!-- ORIGINAL -->

21. SCREENSHOT: product-photo-1 <!-- ORIGINAL -->
    <!-- DISCOVERED: Scroll back UP to show the image carousel before taking the screenshot. Photo 1 is a lifestyle shot (dark room setting). Screenshot captured after scrolling to top of PDP. -->

22. REPEAT_UNTIL: No more photos in the product photo carousel (image does not change after swipe left) <!-- ORIGINAL -->
    a. Swipe left on the product photo carousel
    b. SCREENSHOT: product-photo-{index}
    <!-- ELEMENT: {"screen":"ProductDetailScreen","key":"photoCarousel","android":{"coordinate":[360,600],"swipeDirection":"left","startX":540,"startY":600,"endX":180,"endY":600},"type":"carousel","description":"Product image carousel — swipe left to advance; 6 photos total; wraps back to 1 after last"} -->
    <!-- DISCOVERED: Carousel contains exactly 6 photos. Photo sequence: (1) Lifestyle-dark room, (2) Lifestyle-light room, (3) Grey-background product standalone, (4) Product Dimensions chart (120cm×60cm surface, 72-118cm adjustable height range), (5) Control panel close-up (touch-sensitive panel with up/down arrows), (6) Key Highlights overlay (Engineered Wood, MDF material, 0 drawers, 1 shelf). After photo 6, swiping left returns to photo 1 (carousel wraps). Detect end by comparing consecutive screenshots OR checking carousel dot indicators. Safety limit: 20 swipes. -->

23. CAPTURE: Product price as {{productPrice}} <!-- ORIGINAL -->
    <!-- ELEMENT: {"screen":"ProductDetailScreen","key":"productPrice","android":{"uiautomator":"new UiSelector().text(\"₹18,979\")"},"type":"text","description":"Current selling price displayed in the price row"} -->
    <!-- DISCOVERED: productPrice = "₹18,979". Full price row content-desc = "68%, 59,999, ₹18,979". Price element bounds: [346,586][518,642]. MRP = ₹59,999. -->

24. CAPTURE: Discount percentage offered as {{discountPercentage}} <!-- ORIGINAL -->
    <!-- ELEMENT: {"screen":"ProductDetailScreen","key":"discountPercentage","android":{"uiautomator":"new UiSelector().text(\"68%\")"},"type":"text","description":"Discount percentage badge in the price row"} -->
    <!-- DISCOVERED: discountPercentage = "68%". Element bounds: [72,586][175,642]. Appears as a green badge before the price. MRP strikethrough: ₹59,999. -->

25. REPORT: Print {{productPrice}} and {{discountPercentage}} <!-- ORIGINAL -->

26. Tap the "Buy at" button at the bottom right of the screen <!-- ORIGINAL -->
    <!-- ELEMENT: {"screen":"ProductDetailScreen","key":"buyAtButton","android":{"uiautomator":"new UiSelector().descriptionContains(\"Buy at\")","coordinate":[550,1460]},"type":"button","description":"Buy Now CTA button at bottom — label includes current price, e.g. 'Buy at ₹18,979'"} -->
    <!-- DISCOVERED: Button content-desc includes animated characters and pricing text (e.g., "Buy at ₹18,979"). Use descriptionContains("Buy at") as primary selector. Fallback: coordinate tap at (550, 1460). Tapping this button does NOT go directly to address selection — it triggers the "Frequently Bought Together" bottom sheet (step 27). -->

### FrequentlyBoughtTogetherSheet

27. Tap the "SKIP & CONTINUE" button at the bottom right <!-- ORIGINAL -->
    <!-- ELEMENT: {"screen":"FrequentlyBoughtTogetherSheet","key":"skipAndContinue","android":{"uiautomator":"new UiSelector().text(\"SKIP & CONTINUE\")"},"type":"button","description":"Skip the upsell furniture protection plan and proceed to checkout"} -->
    <!-- DISCOVERED: "Frequently Bought Together" bottom sheet appears with a furniture protection plan upsell. The sheet has two sections — the product and an add-on protection plan. "SKIP & CONTINUE" button is at bounds [377,1430][688,1510]. Use UiSelector text selector — this is a native button, not a WebView element. After tap, navigates to Order Summary (step 2 of checkout). -->

### OrderSummaryScreen

28. Select the address "{{testData.deliveryAddress}}" from the list of delivery addresses <!-- ORIGINAL -->
    <!-- ELEMENT: {"screen":"OrderSummaryScreen","key":"deliveryAddressItem","android":{"uiautomator":"new UiSelector().textContains(\"Flat no. 203, B Block, Tapovan Saraswathi\")"},"type":"text","description":"Delivery address shown in Order Summary — auto-selected when default HOME address exists"} -->
    <!-- DISCOVERED: Address selection list screen was SKIPPED entirely. The app navigated directly to "Order Summary" (Step 2 of checkout) because a default HOME address was already configured on the account. The HOME address is auto-selected — no address chooser list was shown. Screen title confirmed via resource-id="com.flipkart.android:id/title_action_bar" text="Order Summary". Customer name "Srinidhi Sreevatsa" visible at bounds [32,437][286,481]. -->

29. CAPTURE: The address displayed under "Deliver to:" as {{confirmedDeliveryAddress}} <!-- ORIGINAL -->
    <!-- ELEMENT: {"screen":"OrderSummaryScreen","key":"confirmedDeliveryAddress","android":{"uiautomator":"new UiSelector().textContains(\"Flat no. 203, B Block, Tapovan Saraswathi\")"},"type":"text","description":"Full delivery address in Order Summary — multi-line text block"} -->
    <!-- DISCOVERED: confirmedDeliveryAddress = "Flat no. 203, B Block, Tapovan Saraswathi Apartment, 3rd Stage, Industrial Suburb, Vishweshwar nagar, Near Maharshi Public School, Mysuru 570008". Bounds: [32,497][688,673]. Use textContains("Flat no. 203, B Block, Tapovan Saraswathi") to locate and getText() to capture full value. -->

30. Tap "Continue" <!-- ORIGINAL -->
    <!-- ELEMENT: {"screen":"OrderSummaryScreen","key":"continueButton","android":{"uiautomator":"new UiSelector().description(\"Continue \")"},"type":"button","description":"Continue CTA — navigates to Payments screen; note trailing space in content-desc"} -->
    <!-- DISCOVERED: content-desc = "Continue " (with a trailing space). UiSelector.text("Continue") FAILS. Must use UiSelector.description("Continue ") or descriptionContains("Continue"). Button bounds: [376,1426][712,1506]. After tap, navigates to Payments screen (Step 3 of 3 in checkout). -->

### PaymentsScreen

31. CAPTURE: The "Total Amount" displayed on screen as {{totalAmount}} <!-- ORIGINAL -->
    <!-- ELEMENT: {"screen":"PaymentsScreen","key":"totalAmount","android":{"resource-id":"com.flipkart.android:id/webview"},"type":"webview","description":"Payments page rendered in WebView — total amount visible in payment button label"} -->
    <!-- DISCOVERED: Payments page is fully rendered inside a WebView (resource-id="com.flipkart.android:id/webview"). UiAutomator CANNOT access individual elements inside the WebView. Two strategies to capture totalAmount: (1) Visual capture from screenshot — "Pay ₹18,030" visible in Google Pay button. (2) WebView context switch: driver.switchContext("WEBVIEW_com.flipkart.android") then JS execution. totalAmount = "₹18,030" (includes ₹949 Google Pay discount applied automatically). Note: the totalAmount differs from productPrice due to payment-method discounts. -->

32. REPORT: Print {{totalAmount}} <!-- ORIGINAL -->

33. SCREENSHOT: checkout-total-amount <!-- ORIGINAL -->
    <!-- DISCOVERED: Screenshot shows Payments page (Step 3 of 3) with Google Pay option highlighted showing "Pay ₹18,030" (₹949 off). Other payment options visible: UPI, Credit/Debit Card, Net Banking, EMI. -->

34. Navigate back to the "Order Summary" screen <!-- ORIGINAL -->
    <!-- ELEMENT: {"screen":"PaymentsScreen","key":"backAction","android":{"key":"BACK","keycode":4},"type":"navigation","description":"Android system BACK key — navigates from Payments to Order Summary"} -->

35. Navigate back to the "Choose a Delivery Address" screen <!-- ORIGINAL -->
    <!-- ELEMENT: {"screen":"OrderSummaryScreen","key":"backAction","android":{"key":"BACK","keycode":4},"type":"navigation","description":"Android system BACK key — navigates from Order Summary toward search results"} -->
    <!-- DISCOVERED: "Choose a Delivery Address" screen does NOT appear in the back stack when the HOME address was auto-selected (no address chooser was shown on the way forward). Pressing BACK from Order Summary navigates to Search Results, not to an address selection screen. This step effectively navigates back in the app stack regardless of the expected screen name. -->

36. Navigate back one more screen <!-- ORIGINAL -->
    <!-- ELEMENT: {"screen":"SearchResultsScreen","key":"backAction","android":{"key":"BACK","keycode":4},"type":"navigation","description":"Android system BACK key — continues backward navigation through app stack"} -->

### CartScreen

37. Tap the cart icon at the top right of the screen <!-- ORIGINAL -->
    <!-- ELEMENT: {"screen":"SearchResultsScreen","key":"cartIcon","android":{"coordinate":[653,140]},"type":"button","description":"Cart icon in top-right header — shows item count badge; coordinate tap used"} -->
    <!-- DISCOVERED: Cart icon tapped via coordinate (653, 140). No stable resource-id for the icon button itself. Cart badge count: started at 2 (pre-session items), increased to 3 after LUKZER added via "Buy at" flow, then back to 2 after removal. Cart opens to "My Cart" screen with Flipkart and Minutes/Grocery tabs. -->

38. VERIFY: {{productName}} is displayed in the cart <!-- ORIGINAL -->
    <!-- ELEMENT: {"screen":"CartScreen","key":"lukzerCartItem","android":{"uiautomator":"new UiSelector().textContains(\"LUKZER Electric Height Adjustable Desk\")"},"type":"text","description":"LUKZER product row in cart — visible in Flipkart tab"} -->
    <!-- DISCOVERED: Cart has two tabs: "Flipkart (N)" and "Minutes/Grocery (N)". LUKZER appears in the Flipkart tab. Product card shows: quantity Qty:1, price ₹18,979, stock warning "Only 2 left", actions: Remove / Save for later / Buy this now. Full name on cart matches productName exactly. -->

39. SCREENSHOT: cart-with-product <!-- ORIGINAL -->

40. Tap the "Remove" button next to the product <!-- ORIGINAL -->
    <!-- ELEMENT: {"screen":"CartScreen","key":"removeButton","android":{"uiautomator":"new UiSelector().text(\"Remove\")"},"type":"button","description":"Remove product from cart — immediate removal, no confirmation dialog"} -->
    <!-- DISCOVERED: Tapping "Remove" removes the product immediately without any confirmation bottom sheet or dialog. Cart badge decremented from 3→2 after removal. Flipkart tab updated to "Flipkart (1)" showing only the remaining Out of Stock SmartBuy Edge item. -->

41. VERIFY: {{productName}} is no longer displayed in the cart <!-- ORIGINAL -->
    <!-- ELEMENT: {"screen":"CartScreen","key":"lukzerCartItem","android":{"uiautomator":"new UiSelector().textContains(\"LUKZER Electric Height Adjustable Desk\")"},"type":"text","description":"Absence check — element should NOT be found after removal"} -->
    <!-- DISCOVERED: After removal, Flipkart tab shows "Flipkart (1)" with only the Out of Stock "Flipkart SmartBuy Edge To Edge..." screen protector item. Total Amount shown as ₹0 (Out of Stock item cannot be purchased). LUKZER confirmed absent. Use assertThat(element).not().toBeVisible() or verify element not found. -->

42. SCREENSHOT: cart-after-remove <!-- ORIGINAL -->
    <!-- DISCOVERED: Screenshot captured at /tmp/screenshot_1775927435915.png — shows Flipkart(1) tab with SmartBuy Edge item (Out of Stock), Total Amount ₹0, Place order button greyed out, Minutes/Grocery(1) tab. -->

43. Tap the "Home" button at the bottom left of the screen <!-- ORIGINAL -->
    <!-- ELEMENT: {"screen":"CartScreen","key":"homeNavButton","android":{"uiautomator":"new UiSelector().text(\"Home\")"},"type":"navigation","description":"Home tab in bottom navigation bar — navigates to Flipkart home screen"} -->
    <!-- DISCOVERED: Bottom nav shows: Home, Play, Categories, Account, Cart. "Home" button text is stable and locatable via UiSelector.text("Home"). After tap, the app returns to Flipkart home screen with Home tab selected (blue icon highlighted). The Flipkart tab displays the home feed with recommended products. Cart badge reflects final count (2 items). -->

---

## Behavioral Discoveries Summary

| # | Screen | Discovery | Impact |
|---|--------|-----------|--------|
| 1 | HomeScreen | All 4 top nav tabs are image-only React Native elements — no text/ID accessibility nodes | Use coordinate taps only: Flipkart=(105,144), Minutes=(275,144), Travel=(445,144), Grocery=(615,144) |
| 2 | HomeScreen | Minutes tab content-desc is a live countdown timer that changes every second | NEVER match Minutes tab by text or content-desc — coordinate tap only |
| 3 | HomeScreen | Search box placeholder rotates (watches, mobiles, etc.) on each load | Use coordinate tap (360,340) + XPath //android.widget.EditText for input |
| 4 | SearchScreen | Search suggestions reorder query words (e.g., "height adjustable computer table" → "computer table height adjustable") | Tap suggestion by textContains instead of exact text match |
| 5 | HomeScreen | Grocery tab may show a promotional popup on tap | Dismiss with BACK key if popup appears; then navigate to intended screen |
| 6 | ProductDetail | "Buy at" button triggers "Frequently Bought Together" upsell sheet before address selection | Must tap "SKIP & CONTINUE" to proceed to checkout; this step is not in the scenario but must be handled |
| 7 | Checkout | Address selection screen is skipped when a default HOME address is configured | App goes directly to Order Summary (step 2); back-navigation stack does not include address screen |
| 8 | PaymentsScreen | Entire payments page is rendered in WebView — no native UiAutomator accessibility inside | Use screenshot for visual capture; or switch to WebView context + JS for programmatic access |
| 9 | CartScreen | "Remove" button removes product immediately — NO confirmation dialog or bottom sheet | Single tap removes product from cart; no secondary confirmation needed |
| 10 | CartScreen | Cart has separate tabs: "Flipkart" and "Minutes/Grocery" | LUKZER appears in Flipkart tab only; tab counts reflect items per section |

---

## Test Data (Confirmed)

| Field | Value | Source |
|-------|-------|--------|
| searchQuery | height adjustable computer table | Scenario |
| expectedBrand | LUKZER | Scenario |
| deliveryAddress | Flat no. 203, B Block, Tapovan Saraswathi Apartment | Scenario |
| productName (captured) | LUKZER Electric Height Adjustable Desk with USB & Type-C Work from Home Table (EST-004) Engineered Wood Office Table | CAPTURED at runtime |
| productDescription (captured) | Electric Height Adjustable Desk with USB & Type-C Work from Home | CAPTURED at runtime |
| productPrice (captured) | ₹18,979 | CAPTURED at runtime |
| discountPercentage (captured) | 68% | CAPTURED at runtime |
| MRP | ₹59,999 | DISCOVERED at runtime |
| confirmedDeliveryAddress (captured) | Flat no. 203, B Block, Tapovan Saraswathi Apartment, 3rd Stage, Industrial Suburb, Vishweshwar nagar, Near Maharshi Public School, Mysuru 570008 | CAPTURED at runtime |
| totalAmount (captured) | ₹18,030 | CAPTURED at runtime (Google Pay ₹949 discount applied) |

---

## Screen Map

| Screen Name | Steps | Notes |
|-------------|-------|-------|
| FlipkartHomeScreen | 1–12 | App launch state; 4 nav tabs; search box; delivery address row |
| SearchScreen | 13–15 | Search overlay with EditText input and suggestion dropdown |
| SearchResultsScreen | 15–17 | Grid of product cards; scrollable; LUKZER in sponsored position |
| ProductDetailScreen | 17–26 | Image carousel (6 photos); price row; Buy at CTA; product name/description below carousel |
| FrequentlyBoughtTogetherSheet | 26–27 | Bottom sheet upsell; SKIP & CONTINUE button |
| OrderSummaryScreen | 27–30 | Step 2 of 3 checkout; auto-selected HOME address; Continue button |
| PaymentsScreen | 30–33 | Step 3 of 3 checkout; WebView-rendered; payment options; total amount |
| SearchResultsScreen (back) | 33–36 | Returned to search results via 3× BACK presses |
| CartScreen | 37–43 | My Cart with Flipkart and Minutes/Grocery tabs; Remove button |

---

## Notes for Builder

- All coordinate taps (nav tabs, search box, cart icon, Buy at button) must be wrapped in `driver.action().move().press().release().perform()` or equivalent Appium coordinate tap
- The `Continue ` button (step 30) has a trailing space in content-desc — use `accessibility_id("Continue ")` or `uiautomator("new UiSelector().description(\"Continue \")")`
- PaymentsScreen total amount capture requires either: (a) WebView context switch + JS, or (b) visual assertion from screenshot — Builder must implement WebView context switching
- The 6-photo carousel REPEAT_UNTIL loop needs a termination condition: compare screenshot hashes before/after swipe; if hash unchanged, carousel has wrapped — stop
- Cart VERIFY steps (38 and 41) need presence/absence checks: step 38 = `expect(element).toBeVisible()`, step 41 = `expect(element).not().toBeVisible()`
- Appium session for this scenario: mobile/android using AndroidUiAutomator2Driver; webDriverIO or Appium JS client
