import { browser, expect } from '@wdio/globals';
import { FlipkartSearchScreen } from '../../../screens/FlipkartSearchScreen';
import { FlipkartProductScreen } from '../../../screens/FlipkartProductScreen';
import { FlipkartCartScreen } from '../../../screens/FlipkartCartScreen';
import testData from '../../../test-data/mobile/flipkart-search-add-to-cart.json';

/**
 * Quick popup dismisser — checks ONLY for known Flipkart popups.
 * Much faster than full PopupGuard because it uses a single UiSelector query.
 */
async function dismissPopups(): Promise<void> {
  for (let i = 0; i < 3; i++) {
    try {
      const notNow = await browser.$('android=new UiSelector().text("NOT NOW")');
      if (await notNow.isExisting()) {
        await notNow.click();
        await browser.pause(1000);
        continue;
      }
    } catch { /* no popup */ }

    try {
      const denyPerm = await browser.$('id=com.android.permissioncontroller:id/permission_deny_button');
      if (await denyPerm.isExisting()) {
        await denyPerm.click();
        await browser.pause(1000);
        continue;
      }
    } catch { /* no popup */ }

    break;
  }
}

/**
 * Navigate to Flipkart main home screen from a clean state.
 * Force-stops and relaunches the app to clear any stale navigation stack.
 */
async function navigateToFlipkartHome(): Promise<void> {
  // Force-stop clears in-memory state but keeps login (noReset: true preserves app data)
  await browser.executeScript('mobile: shell', [{ command: 'am', args: ['force-stop', 'com.flipkart.android'] }]);
  await browser.pause(2000);

  // Relaunch the app
  await browser.executeScript('mobile: shell', [{ command: 'am', args: ['start', '-n', 'com.flipkart.android/.SplashActivity'] }]);
  await browser.pause(6000);
  await dismissPopups();

  // Tap Flipkart tab at top-left to ensure we're on the main marketplace
  await browser.action('pointer')
    .move({ duration: 0, origin: 'viewport', x: 67, y: 130 })
    .down({ button: 0 }).pause(100).up({ button: 0 }).perform();
  await browser.pause(3000);
  await dismissPopups();
}

describe('Flipkart — Search and Add to Cart @smoke @P0', () => {
  let searchScreen: FlipkartSearchScreen;
  let productScreen: FlipkartProductScreen;
  let cartScreen: FlipkartCartScreen;

  before(async () => {
    searchScreen = new FlipkartSearchScreen(browser);
    productScreen = new FlipkartProductScreen(browser);
    cartScreen = new FlipkartCartScreen(browser);
  });

  it(`should search for "${testData.search.query}" and add to cart @smoke @P0`, async () => {
    // Step 1 — Navigate to Flipkart home from any initial state
    await navigateToFlipkartHome();
    console.log('Step 1: Flipkart home reached');

    // Step 2 — Tap search bar (coordinate tap — search bar desc rotates)
    await browser.action('pointer')
      .move({ duration: 0, origin: 'viewport', x: 300, y: 348 })
      .down({ button: 0 }).pause(100).up({ button: 0 }).perform();
    await browser.pause(2000);
    console.log('Step 2: Search bar tapped');

    // Step 3 — Type search query and submit
    await searchScreen.waitForScreen();
    await searchScreen.searchFor(testData.search.query);
    console.log(`Step 3: Searched for "${testData.search.query}"`);

    // Step 4 — Wait for results, dismiss popups
    await browser.pause(5000);
    await dismissPopups();
    console.log('Step 4: Popups dismissed');

    // Step 5 — VERIFY & tap first product
    const firstProduct = await browser.$(`android=new UiSelector().textContains("${testData.search.firstProductKeyword}")`);
    await firstProduct.waitForExist({ timeout: 15000 });
    expect(await firstProduct.isDisplayed()).toBe(true);
    console.log('Step 5: Search results visible');

    await firstProduct.click();
    await browser.pause(3000);
    console.log('Step 6: First product tapped');

    // Step 7 — Wait for product detail page
    await productScreen.waitForScreen();
    const price = await productScreen.getPrice();
    console.log(`Step 7: Product loaded, price: ${price}`);

    // Step 8 — Add to Cart (or go to cart if already added from previous run)
    if (await productScreen.isAddToCartVisible()) {
      await productScreen.tapAddToCart();
      await browser.pause(3000);
      console.log('Step 8: Added to cart');
      // Step 9 — Go to Cart
      await productScreen.tapGoToCart();
      console.log('Step 9: Navigating to cart');
    } else {
      console.log('Step 8: Item already in cart (from previous run)');
      await productScreen.tapGoToCart();
      console.log('Step 9: Navigating to cart');
    }

    // Step 10 — Verify cart
    await cartScreen.waitForScreen();
    const cartHeader = await cartScreen.getCartHeader();
    console.log(`Step 10: ${cartHeader}`);

    expect(await cartScreen.hasItems()).toBe(true);
    expect(await cartScreen.isPlaceOrderVisible()).toBe(true);

    const itemPrice = await cartScreen.getFirstItemPrice();
    console.log(`Cart item price: ${itemPrice}`);
    await cartScreen.takeScreenshot('flipkart-05-cart');

    console.log('=== PASSED: Search → Product → Add to Cart → Cart verified ===');
  });
});
