import { BaseScreen } from '../core/base-screen';

export class FrequentlyBoughtTogetherSheet extends BaseScreen {
  constructor(driver: WebdriverIO.Browser) {
    super(driver, 'frequently-bought-together-sheet');
  }

  /**
   * Wait for the "Frequently Bought Together" bottom sheet to appear.
   * DISCOVERED: Sheet shows a furniture protection plan upsell after tapping "Buy at".
   */
  async waitForSheet(timeoutMs = 15000): Promise<void> {
    await this.waitForElement('skipAndContinue', 'displayed', timeoutMs);
  }

  /**
   * Tap "SKIP & CONTINUE" to bypass the upsell and proceed to Order Summary.
   * DISCOVERED: Navigates to Order Summary (Step 2 of checkout) after tap.
   */
  async tapSkipAndContinue(): Promise<void> {
    await this.tap('skipAndContinue');
    await this.driver.pause(3000);
  }
}
