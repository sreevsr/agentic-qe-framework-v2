# Scenario: Flipkart — Product Search, Buy Now Navigation, and Cart Verification

## Metadata
- **Module:** Shopping / Cart Management
- **Priority:** P1
- **Type:** mobile
- **Platform:** android
- **Tags:** mobile, regression, P1, shopping, cart, search, flipkart

## Application
- **App Package (Android):** {{ENV.APP_PACKAGE}}
- **App Activity (Android):** {{ENV.APP_ACTIVITY}}
- **Bundle ID (iOS):** N/A
- **Device:** {{ENV.ANDROID_DEVICE}}
- **Credentials:** N/A (user session already active; delivery address pre-saved in account)

## Pre-conditions
- Flipkart app is installed on Android device/emulator
- Device is connected and accessible via ADB
- Appium server is running (localhost:4723)
- User is already logged in to Flipkart (session persisted from a previous login)
- Delivery address "Flat no. 203, B Block, Tapovan Saraswathi Apartment" is saved in the Flipkart account
- App launches directly to the home screen

## Steps

1. Wait for the Flipkart home screen to be visible (stable screen identifier: top navigation tabs row)
2. VERIFY: The following navigation tabs are displayed at the top of the screen: "Flipkart", "Minutes", "Travel", "Grocery"
3. VERIFY: The delivery address shown at the top of the screen contains "Flat no. 203, B Block, Tapovan Saraswathi Apartment"
4. Tap the "Flipkart" tab at the top
5. SCREENSHOT: flipkart-tab
6. Tap the "Minutes" tab at the top
7. SCREENSHOT: minutes-tab
8. Tap the "Travel" tab at the top
9. SCREENSHOT: travel-tab
10. Tap the "Grocery" tab at the top
11. SCREENSHOT: grocery-tab
12. Tap the "Flipkart" tab at the top to return to the main shopping section
13. Tap the search box
14. Type "height adjustable computer table" in the search box
15. Tap "height adjustable computer table" from the search suggestions list
16. REPEAT_UNTIL: A product with "LUKZER" in its name is visible in the search results
    a. Scroll down in search results
17. Tap the first visible product in search results whose name contains "LUKZER"
18. CAPTURE: Full product name displayed below the product photos as {{productName}}
19. CAPTURE: Product description displayed below the product photos as {{productDescription}}
20. REPORT: Print {{productName}} and {{productDescription}}
21. SCREENSHOT: product-photo-1
22. REPEAT_UNTIL: No more photos in the product photo carousel (image does not change after swipe left)
    a. Swipe left on the product photo carousel
    b. SCREENSHOT: product-photo-{index}
23. CAPTURE: Product price as {{productPrice}}
24. CAPTURE: Discount percentage offered as {{discountPercentage}}
25. REPORT: Print {{productPrice}} and {{discountPercentage}}
26. Tap the "Buy at" button at the bottom right of the screen
27. Tap the "SKIP & CONTINUE" button at the bottom right
28. Select the address "{{testData.deliveryAddress}}" from the list of delivery addresses
29. CAPTURE: The address displayed under "Deliver to:" as {{confirmedDeliveryAddress}}
30. Tap "Continue"
31. CAPTURE: The "Total Amount" displayed on screen as {{totalAmount}}
32. REPORT: Print {{totalAmount}}
33. SCREENSHOT: checkout-total-amount
34. Navigate back to the "Order Summary" screen
35. Navigate back to the "Choose a Delivery Address" screen
36. Navigate back one more screen
37. Tap the cart icon at the top right of the screen
38. VERIFY: {{productName}} is displayed in the cart
39. SCREENSHOT: cart-with-product
40. Tap the "Remove" button next to the product
41. VERIFY: {{productName}} is no longer displayed in the cart
42. SCREENSHOT: cart-after-remove
43. Tap the "Home" button at the bottom left of the screen

## Test Data
| Field | Value | Notes |
|-------|-------|-------|
| searchQuery | height adjustable computer table | Product search term |
| expectedBrand | LUKZER | Brand name to find in search results |
| deliveryAddress | Flat no. 203, B Block, Tapovan Saraswathi Apartment | Pre-saved delivery address in the Flipkart account |

## Notes for Explorer
- App package default: `com.flipkart.android`; confirm actual values and update ENV vars
- Top navigation tab labels may be abbreviated or stylised — accept partial matches ("Minutes" may show as "Flipkart Minutes")
- The delivery address at the top is typically truncated to one line — use `contains` matching, not exact string
- The search suggestions dropdown appears while typing — wait for it before tapping the suggestion
- The LUKZER product position in search results varies — scroll until the first LUKZER product is visible, then tap
- Product photo carousel: detect end of carousel by comparing image content-desc or index before/after swipe; maximum safety limit 20 swipes
- The "Buy at" button label may include pricing text (e.g., "Buy at ₹2,499") — match by starts-with or contains
- After tapping "SKIP & CONTINUE", the delivery address selection screen lists saved addresses
- Address selection: match by partial text containing "Flat no. 203, B Block, Tapovan Saraswathi Apartment"
- The "Total Amount" may appear on a payment options screen or order summary screen — capture the numeric value shown
- After navigating back 3 times from the total amount screen, expect to land on the product detail page or the search results page
- Cart icon is in the top-right header; may show a badge with item count
- The "Remove" button in the cart may trigger a confirmation bottom sheet — tap "Remove" to confirm
- Keyboard MUST be dismissed after typing in the search box before proceeding to the next step
- IF: Any login/sign-in overlay appears during the flow → dismiss or handle it (user should already be logged in)
- IF: Any promotional popup or notification permission dialog appears → dismiss it

<!--
ENV VARS REQUIRED:
  APP_PACKAGE       — Flipkart Android app package (default: com.flipkart.android)
  APP_ACTIVITY      — Flipkart launch activity (default: com.flipkart.android.MainActivity or similar)
  ANDROID_DEVICE    — ADB device identifier (e.g., emulator-5554 or device serial)
-->