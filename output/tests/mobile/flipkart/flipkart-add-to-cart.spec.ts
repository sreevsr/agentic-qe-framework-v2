import { browser, expect } from '@wdio/globals';
import { FlipkartHomeScreen } from '../../../screens/FlipkartHomeScreen';
import { FlipkartSearchScreen } from '../../../screens/FlipkartSearchScreen';
import { FlipkartSearchResultsScreen } from '../../../screens/FlipkartSearchResultsScreen';
import { ProductDetailScreen } from '../../../screens/ProductDetailScreen';
import { FrequentlyBoughtTogetherSheet } from '../../../screens/FrequentlyBoughtTogetherSheet';
import { OrderSummaryScreen } from '../../../screens/OrderSummaryScreen';
import { PaymentsScreen } from '../../../screens/PaymentsScreen';
import { FlipkartCartScreen } from '../../../screens/FlipkartCartScreen';
import testData from '../../../test-data/mobile/flipkart-add-to-cart.json';

// CAPTURE variables — declared in outer describe scope (WDIO/Mocha scoping requirement)
let productName: string;
let productDescription: string;
let productPrice: string;
let discountPercentage: string;
let confirmedDeliveryAddress: string;
let totalAmount: string;

/**
 * Force-stop and relaunch Flipkart app to ensure clean navigation state.
 * noReset:true preserves login and delivery address configuration.
 *
 * FIX: Use Appium terminateApp/activateApp instead of `am start -n ...MainActivity`.
 * Launching MainActivity directly (bypassing SplashActivity) skips critical app
 * initialization and causes immediate crash. activateApp() uses the proper entry
 * point from the app manifest (SplashActivity → MainActivity lifecycle).
 */
async function launchFlipkartApp(): Promise<void> {
  await browser.terminateApp('com.flipkart.android');
  await browser.pause(1000);
  await browser.activateApp('com.flipkart.android');
  // PACING: SplashActivity + MainActivity initialization — waitForHomeScreenVisible handles the actual wait
  await browser.pause(3000);
}

describe('Flipkart — Product Search, Buy Now Navigation, and Cart Verification @regression @P1 @android-only', () => {
  let homeScreen: FlipkartHomeScreen;
  let searchScreen: FlipkartSearchScreen;
  let searchResultsScreen: FlipkartSearchResultsScreen;
  let productDetailScreen: ProductDetailScreen;
  let fboughtTogetherSheet: FrequentlyBoughtTogetherSheet;
  let orderSummaryScreen: OrderSummaryScreen;
  let paymentsScreen: PaymentsScreen;
  let cartScreen: FlipkartCartScreen;

  before(async () => {
    homeScreen = new FlipkartHomeScreen(browser);
    searchScreen = new FlipkartSearchScreen(browser);
    searchResultsScreen = new FlipkartSearchResultsScreen(browser);
    productDetailScreen = new ProductDetailScreen(browser);
    fboughtTogetherSheet = new FrequentlyBoughtTogetherSheet(browser);
    orderSummaryScreen = new OrderSummaryScreen(browser);
    paymentsScreen = new PaymentsScreen(browser);
    cartScreen = new FlipkartCartScreen(browser);
    await launchFlipkartApp();
  });

  it(`should navigate tabs, search for ${testData.expectedBrand} product, proceed through Buy Now checkout, verify cart, and remove item @regression @P1 @mobile @shopping @cart`, async () => {

    // ─── FlipkartHomeScreen ───────────────────────────────────────────────────

    // Step 1 — Wait for Flipkart home screen to be visible
    await homeScreen.waitForHomeScreenVisible(20000);
    console.log('Step 1: Flipkart home screen confirmed visible');

    // Step 2 — VERIFY: Navigation tabs displayed at the top of the screen
    const tabCount = await homeScreen.getNavTabImageCount();
    expect(tabCount).toBeGreaterThanOrEqual(4);
    console.log(`Step 2: VERIFY nav tabs — ${tabCount} top-nav ImageView elements found`);

    // Step 3 — VERIFY: Delivery address contains expected address text
    const deliveryAddressPreview = await homeScreen.getDeliveryAddressText();
    expect(deliveryAddressPreview).toContain(testData.deliveryAddressSubstring);
    console.log(`Step 3: VERIFY delivery address — "${deliveryAddressPreview}"`);

    // Step 4 — Tap the Flipkart tab at the top
    await homeScreen.tapFlipkartTab();
    console.log('Step 4: Tapped Flipkart tab');

    // Step 5 — SCREENSHOT: flipkart-tab
    await homeScreen.takeScreenshot('flipkart-tab');

    // Step 6 — Tap the Minutes tab at the top
    await homeScreen.tapMinutesTab();
    console.log('Step 6: Tapped Minutes tab');

    // Step 7 — SCREENSHOT: minutes-tab
    await homeScreen.takeScreenshot('minutes-tab');

    // Step 8 — Tap the Travel tab at the top
    await homeScreen.tapTravelTab();
    console.log('Step 8: Tapped Travel tab');

    // Step 9 — SCREENSHOT: travel-tab
    await homeScreen.takeScreenshot('travel-tab');

    // Step 10 — Tap the Grocery tab at the top
    // DISCOVERED: May show promotional popup — guard.dismiss() called inside tapGroceryTab()
    await homeScreen.tapGroceryTab();
    console.log('Step 10: Tapped Grocery tab (popups dismissed if any)');

    // Step 11 — SCREENSHOT: grocery-tab
    await homeScreen.takeScreenshot('grocery-tab');

    // Step 12 — Tap the Flipkart tab to return to main shopping section
    // DISCOVERED: If promo popup visible from Grocery tab, dismiss first
    await homeScreen.tapFlipkartTab();
    console.log('Step 12: Returned to Flipkart tab');

    // ─── SearchScreen ─────────────────────────────────────────────────────────

    // Step 13 — Tap the search box
    // DISCOVERED: Placeholder text rotates — coordinate tap (360,340) is reliable
    await homeScreen.tapSearchBox();
    console.log('Step 13: Tapped search box');

    // Step 14 — Type search query in the search box (do NOT press Enter — wait for suggestions)
    await searchScreen.waitForScreen();
    const searchInput = await browser.$('android=new UiSelector().className("android.widget.EditText")');
    await searchInput.setValue(testData.searchQuery);
    await browser.pause(3000); // Wait for suggestions to populate
    console.log(`Step 14: Typed "${testData.searchQuery}"`);

    // Step 15 — Tap the search suggestion from the list
    // DISCOVERED: App reorders query words in suggestions (e.g. "computer table height adjustable")
    await searchScreen.tapSuggestion(testData.searchSuggestionKeyword);
    console.log(`Step 15: Tapped search suggestion containing "${testData.searchSuggestionKeyword}"`);

    // ─── SearchResultsScreen ──────────────────────────────────────────────────

    // Step 16 — REPEAT_UNTIL: Scroll until LUKZER product is visible in results
    // DISCOVERED: LUKZER appears after ~2 scroll-down gestures; safety limit: 10 scrolls
    await searchResultsScreen.waitForResults(testData.timeouts.screenLoadMs);
    await searchResultsScreen.scrollToFindProduct(testData.expectedBrand, 10);
    console.log(`Step 16: Scrolled to find "${testData.expectedBrand}" product`);

    // Step 17 — Tap the first visible LUKZER product card
    await searchResultsScreen.tapProductByKeyword(testData.expectedBrand);
    console.log('Step 17: Tapped LUKZER product card');

    // ─── ProductDetailScreen ──────────────────────────────────────────────────

    // Step 18 — CAPTURE: Full product name as productName
    await productDetailScreen.waitForScreen();
    productName = await productDetailScreen.getProductName();
    console.log(`Step 18: CAPTURE productName = "${productName}"`);

    // Step 19 — CAPTURE: Product description as productDescription
    productDescription = await productDetailScreen.getProductDescription();
    console.log(`Step 19: CAPTURE productDescription = "${productDescription}"`);

    // Step 20 — REPORT: Print productName and productDescription
    console.log(`[REPORT] Step 20 — productName="${productName}" | productDescription="${productDescription}"`);

    // Step 21 — SCREENSHOT: product-photo-1 (scroll up to show carousel first)
    await productDetailScreen.scrollUpToCarousel();
    await productDetailScreen.takeScreenshot('product-photo-1');

    // Step 22 — REPEAT_UNTIL: Swipe carousel until all photos are cycled
    // DISCOVERED: Carousel has exactly 6 photos; wraps back to photo 1 after photo 6
    const totalCarouselPhotos = 6;
    for (let photoIdx = 2; photoIdx <= totalCarouselPhotos; photoIdx++) {
      // Step 22a — Swipe left on product photo carousel
      await productDetailScreen.swipeCarouselLeft();
      // Step 22b — SCREENSHOT: product-photo-{index}
      await productDetailScreen.takeScreenshot(`product-photo-${photoIdx}`);
    }
    console.log(`Step 22: Swiped through all ${totalCarouselPhotos} carousel photos`);

    // Step 23 — CAPTURE: Product price as productPrice
    await productDetailScreen.scrollDownToContent();
    productPrice = await productDetailScreen.getProductPrice();
    console.log(`Step 23: CAPTURE productPrice = "${productPrice}"`);

    // Step 24 — CAPTURE: Discount percentage as discountPercentage
    discountPercentage = await productDetailScreen.getDiscountPercentage();
    console.log(`Step 24: CAPTURE discountPercentage = "${discountPercentage}"`);

    // Step 25 — REPORT: Print productPrice and discountPercentage
    console.log(`[REPORT] Step 25 — productPrice="${productPrice}" | discountPercentage="${discountPercentage}"`);

    // Step 26 — Tap the "Buy at" button at the bottom right
    // DISCOVERED: Triggers "Frequently Bought Together" bottom sheet, NOT direct checkout
    await productDetailScreen.tapBuyAtButton();
    console.log('Step 26: Tapped "Buy at" button');

    // ─── FrequentlyBoughtTogetherSheet ───────────────────────────────────────

    // Step 27 — Tap "SKIP & CONTINUE" to bypass the upsell
    await fboughtTogetherSheet.waitForSheet(testData.timeouts.screenLoadMs);
    await fboughtTogetherSheet.tapSkipAndContinue();
    console.log('Step 27: Tapped SKIP & CONTINUE on Frequently Bought Together sheet');

    // ─── OrderSummaryScreen ───────────────────────────────────────────────────

    // Step 28 — Select delivery address (auto-selected: default HOME address pre-configured)
    // DISCOVERED: Address selection screen skipped entirely; app navigates directly to Order Summary
    await orderSummaryScreen.waitForScreen(testData.timeouts.screenLoadMs);
    const isAddressShown = await orderSummaryScreen.isAddressVisible(testData.deliveryAddress);
    expect(isAddressShown).toBe(true);
    console.log(`Step 28: Delivery address "${testData.deliveryAddress}" auto-selected and visible`);

    // Step 29 — CAPTURE: Full delivery address as confirmedDeliveryAddress
    confirmedDeliveryAddress = await orderSummaryScreen.getDeliveryAddressText();
    console.log(`Step 29: CAPTURE confirmedDeliveryAddress = "${confirmedDeliveryAddress}"`);

    // Step 30 — Tap Continue to proceed to Payments
    await orderSummaryScreen.tapContinue();
    console.log('Step 30: Tapped Continue');

    // ─── PaymentsScreen ───────────────────────────────────────────────────────

    // Step 31 — CAPTURE: Total Amount displayed on screen as totalAmount
    // DISCOVERED: Page in WebView; uses native accessibility tree + WebView context fallback
    await paymentsScreen.waitForScreen(testData.timeouts.webViewMs);
    totalAmount = await paymentsScreen.getTotalAmount();
    console.log(`Step 31: CAPTURE totalAmount = "${totalAmount}"`);

    // Step 32 — REPORT: Print totalAmount
    console.log(`[REPORT] Step 32 — totalAmount="${totalAmount}"`);

    // Step 33 — SCREENSHOT: checkout-total-amount
    await paymentsScreen.takeScreenshot('checkout-total-amount');

    // Step 34 — Navigate back to Order Summary screen
    await paymentsScreen.pressBack();
    console.log('Step 34: Navigated back from Payments to Order Summary');

    // Step 35 — Navigate back from Order Summary
    // DISCOVERED: Back stack skips Address screen (was auto-selected; not shown on forward path)
    await orderSummaryScreen.pressBack();
    console.log('Step 35: Navigated back from Order Summary');

    // Step 36 — Navigate back one more screen
    await browser.pressKeyCode(4);
    await browser.pause(2000);
    console.log('Step 36: Navigated back one more screen');

    // ─── CartScreen ───────────────────────────────────────────────────────────

    // Step 37 — Tap the cart icon at the top right of the screen
    // DISCOVERED: No stable resource-id for cart icon; coordinate tap (653,140)
    await searchResultsScreen.tapCartIcon();
    console.log('Step 37: Tapped cart icon');

    // Step 38 — VERIFY: productName is displayed in the cart
    await cartScreen.waitForScreen();
    const isInCart = await cartScreen.isProductVisible(testData.expectedBrand);
    expect(isInCart).toBe(true);
    console.log(`Step 38: VERIFY "${testData.expectedBrand}" product is in cart — PASSED`);

    // Step 39 — SCREENSHOT: cart-with-product
    await cartScreen.takeScreenshot('cart-with-product');

    // Step 40 — Tap the Remove button next to the product
    // DISCOVERED: Immediate removal — no confirmation dialog or bottom sheet
    await cartScreen.tapRemoveButton();
    console.log('Step 40: Tapped Remove button — product removed immediately');

    // Step 41 — VERIFY: productName is no longer displayed in the cart
    const isAbsent = await cartScreen.isProductAbsent(testData.expectedBrand);
    expect(isAbsent).toBe(true);
    console.log(`Step 41: VERIFY "${testData.expectedBrand}" is no longer in cart — PASSED`);

    // Step 42 — SCREENSHOT: cart-after-remove
    await cartScreen.takeScreenshot('cart-after-remove');

    // Step 43 — Tap the Home button at the bottom left of the screen
    await cartScreen.tapHomeNavButton();
    console.log('Step 43: Tapped Home nav button — returned to Flipkart home screen');

    console.log('=== PASSED: Tab navigation → Search → LUKZER PDP → Buy Now → Checkout → Cart verify → Remove → Home ===');
  });
});
