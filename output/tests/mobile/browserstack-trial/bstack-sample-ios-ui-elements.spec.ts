import { browser, expect } from '@wdio/globals';
import { BStackSampleUIElementsScreen } from '../../../screens/BStackSampleUIElementsScreen';
import { BStackSampleWebViewScreen } from '../../../screens/BStackSampleWebViewScreen';
import { applyHelpers } from '../../../screens/BStackSampleUIElementsScreen.helpers';

/**
 * BStack Sample iOS — UI Elements, Alert, and Web View tab @ios-only @P0 @cloud
 *
 * First non-trivial iOS scenario on the framework. Runs against a cloud
 * iPhone 14 (iOS 16) on BrowserStack App Automate — no macOS required.
 *
 * Exercises:
 *   - iOS-only @ios-only tag routing
 *   - MobileLocatorLoader iOS strategy priority (accessibility_id + class_chain)
 *   - Screen Object composition (2 screens via tab bar navigation)
 *   - Native iOS alert handling via applyHelpers() pattern
 *     (this is the first real exercise of per-screen iOS helpers for a
 *     framework-level gap — BaseScreen has no alert API)
 */
describe('BStack Sample iOS — UI Elements, Alert, and Web View tab @ios-only @P0 @cloud', () => {
  let uiElementsScreen: ReturnType<typeof applyHelpers>;
  let webViewScreen: BStackSampleWebViewScreen;

  before(async () => {
    uiElementsScreen = applyHelpers(new BStackSampleUIElementsScreen(browser));
    webViewScreen = new BStackSampleWebViewScreen(browser);
  });

  it('should show Alert button, fire native alert, and switch to Web View tab', async () => {
    // Step 1 — Launch; VERIFY UI Elements screen visible
    await uiElementsScreen.waitForScreen();

    // Step 2 — VERIFY Text button is visible
    expect(await uiElementsScreen.isTextButtonVisible()).toBe(true);

    // Step 3 — VERIFY Alert button is visible
    expect(await uiElementsScreen.isAlertButtonVisible()).toBe(true);

    // Step 4 — Tap the Alert button
    await uiElementsScreen.tapAlertButton();

    // Step 5 — VERIFY native iOS alert appears
    await uiElementsScreen.waitForAlert();

    // Step 6 — CAPTURE the alert text
    const alertText = await uiElementsScreen.getAlertText();

    // Step 7 — REPORT the alert text
    console.log(`[bstack-sample-ios] alert text: ${JSON.stringify(alertText)}`);
    expect(alertText).toContain('Alert');
    expect(alertText).toContain('This is a native alert.');

    // Step 8 — Accept / dismiss the alert (tap OK)
    await uiElementsScreen.acceptAlert();

    // Step 9 — VERIFY the alert is no longer visible
    await uiElementsScreen.waitForAlertGone();

    // Step 10 — Tap the Web View tab
    await uiElementsScreen.tapWebViewTab();

    // Step 11 — VERIFY Web View screen is visible (WKWebView element present)
    await webViewScreen.waitForScreen();
    expect(await webViewScreen.isWebViewVisible()).toBe(true);

    // Step 12 — SCREENSHOT: web-view-tab-loaded
    await webViewScreen.takeScreenshot('web-view-tab-loaded');

    // Step 13 — Tap the UI Elements tab to return
    await webViewScreen.tapUIElementsTab();

    // Step 14 — VERIFY UI Elements screen is visible again (Alert button visible)
    await uiElementsScreen.waitForScreen();
    expect(await uiElementsScreen.isAlertButtonVisible()).toBe(true);
  });
});
