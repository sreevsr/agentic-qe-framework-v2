import { browser } from '@wdio/globals';
import { BStackSampleUIElementsScreen } from './BStackSampleUIElementsScreen';

/**
 * iOS native alert helpers for the BStackSample UI Elements screen.
 *
 * Why this file exists
 * --------------------
 * BaseScreen provides generic element interactions but has no native alert
 * API (`getAlertText`, `acceptAlert`, `dismissAlert`) — that's a framework gap
 * surfaced the first time a real iOS scenario needed to interact with an
 * XCUIElementTypeAlert. Rather than modify the framework-owned BaseScreen for
 * a single screen's needs, the helper pattern attaches alert methods to this
 * screen only.
 *
 * Usage from a spec:
 *
 *   import { BStackSampleUIElementsScreen } from '...';
 *   import { applyHelpers } from '.../BStackSampleUIElementsScreen.helpers';
 *
 *   const screen = applyHelpers(new BStackSampleUIElementsScreen(browser));
 *   await screen.tapAlertButton();
 *   await screen.waitForAlert();
 *   const text = await screen.getAlertText();
 *   await screen.acceptAlert();
 *
 * Notes
 * -----
 * - Uses WebDriver protocol commands (`browser.getAlertText()`,
 *   `browser.acceptAlert()`) which Appium XCUITest maps onto
 *   XCUIElementTypeAlert automatically.
 * - The Sample iOS app's alert has only an "OK" button — no Cancel — so
 *   accept is the only meaningful dismissal here. `dismissAlert` is
 *   provided for future scenarios with two-button alerts.
 * - `waitForAlert` polls `getAlertText` rather than looking for the
 *   XCUIElementTypeAlert element, because some versions of Appium render
 *   alerts in a separate accessibility container that the locator loader
 *   can miss on the first poll.
 */
export interface BStackSampleUIElementsScreenWithHelpers extends BStackSampleUIElementsScreen {
  waitForAlert(timeoutMs?: number): Promise<void>;
  waitForAlertGone(timeoutMs?: number): Promise<void>;
  getAlertText(): Promise<string>;
  acceptAlert(): Promise<void>;
  dismissAlert(): Promise<void>;
}

export function applyHelpers(
  screen: BStackSampleUIElementsScreen,
): BStackSampleUIElementsScreenWithHelpers {
  const enriched = screen as BStackSampleUIElementsScreenWithHelpers;

  enriched.waitForAlert = async function (timeoutMs = 10000): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    let lastErr: unknown;
    while (Date.now() < deadline) {
      try {
        await browser.getAlertText();
        return;
      } catch (err) {
        lastErr = err;
        await browser.pause(250);
      }
    }
    throw new Error(
      `Native alert did not appear within ${timeoutMs}ms. Last error: ${(lastErr as Error)?.message ?? 'unknown'}`,
    );
  };

  enriched.waitForAlertGone = async function (timeoutMs = 5000): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      try {
        await browser.getAlertText();
      } catch {
        return;
      }
      await browser.pause(250);
    }
    throw new Error(`Native alert was still visible after ${timeoutMs}ms`);
  };

  enriched.getAlertText = async function (): Promise<string> {
    return browser.getAlertText();
  };

  enriched.acceptAlert = async function (): Promise<void> {
    await browser.acceptAlert();
  };

  enriched.dismissAlert = async function (): Promise<void> {
    await browser.dismissAlert();
  };

  return enriched;
}
