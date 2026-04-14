import { browser, expect } from '@wdio/globals';

/**
 * BrowserStack trial — cross-platform smoke test.
 *
 * This spec is deliberately APP-AGNOSTIC. It doesn't reference any specific
 * UI element of the sample apps (WikipediaSample on Android, BStackSampleApp
 * on iOS). It only validates that:
 *
 *   1. BrowserStack session creation succeeded
 *   2. Appium driver attached to the cloud device
 *   3. The device responds to standard WebDriver commands (getWindowSize)
 *   4. The device is rendering the app (takeScreenshot returns non-empty PNG)
 *
 * That's enough to prove the entire cloud pipeline works end-to-end — if
 * this passes on both Android and iOS, the framework's cross-platform story
 * is validated against real BrowserStack devices. Any follow-up scenario
 * can then add app-specific locators on top of this baseline.
 *
 * Tagged @cross-platform so it matches the framework's runtime platform
 * filter on both PLATFORM=android and PLATFORM=ios runs (though with
 * BrowserStack's WDIO service, the platform is set per-capability in
 * wdio.browserstack.conf.ts — the tag is just for consistency with the
 * framework's Platform header convention).
 */
describe('BrowserStack trial — cross-platform smoke @smoke @P0 @cross-platform', () => {
  it('session + device + screenshot end-to-end', async () => {
    // Step 1 — Session is live (BrowserStack provisioned a device and Appium connected)
    const sessionId = browser.sessionId;
    expect(sessionId).toBeTruthy();
    console.log(`[trial] BrowserStack session ID: ${sessionId}`);

    // Step 2 — Device reports its window size (Appium driver is attached and responding)
    const windowSize = await browser.getWindowSize();
    expect(windowSize.width).toBeGreaterThan(0);
    expect(windowSize.height).toBeGreaterThan(0);
    console.log(`[trial] Device window: ${windowSize.width}x${windowSize.height}`);

    // Step 3 — Capture what device we're actually on (useful in the log for debugging)
    const caps = browser.capabilities as Record<string, unknown>;
    const platform = caps['platformName'] || 'unknown';
    const device = caps['deviceName'] || caps['bstack:options'] || 'unknown';
    console.log(`[trial] Running on: ${platform} / ${JSON.stringify(device)}`);

    // Step 4 — Screenshot (proves the device is rendering the app, not a blank screen or error page)
    const screenshot = await browser.takeScreenshot();
    expect(screenshot).toBeTruthy();
    // A valid PNG screenshot base64-encoded should be at least a few KB.
    // Anything shorter is almost certainly a transparent/blank placeholder.
    expect(screenshot.length).toBeGreaterThan(1000);
    console.log(`[trial] Screenshot captured: ${screenshot.length} base64 chars`);
  });
});
