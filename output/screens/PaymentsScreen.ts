import { BaseScreen } from '../core/base-screen';

/**
 * Flipkart Payments screen (Step 3 of 3 in checkout).
 *
 * CORRECTED: This screen is FULLY NATIVE, NOT a WebView.
 * Previous implementation assumed a WebView container (resource-id=com.flipkart.android:id/webview)
 * and attempted WebView context switching. That was wrong — all elements (Total Amount,
 * UPI radio buttons, payment options, etc.) are native Android widgets.
 */
export class PaymentsScreen extends BaseScreen {
  constructor(driver: WebdriverIO.Browser) {
    super(driver, 'payments-screen');
  }

  /** Wait for the Payments screen header to be visible. */
  async waitForScreen(timeoutMs = 20000): Promise<void> {
    await this.driver.pause(2000);
    await this.waitForElement('screenHeader', 'displayed', timeoutMs);
  }

  /**
   * Capture the Total Amount value (e.g., "₹18,030") from the Total Amount row.
   * Uses a generic sibling XPath locator — works for any product/price.
   */
  async getTotalAmount(): Promise<string> {
    try {
      return await this.getText('totalAmountValue');
    } catch (err) {
      console.log(`[PaymentsScreen] getTotalAmount failed: ${(err as Error).message.substring(0, 200)}`);
      return '';
    }
  }

  /** Press Android BACK key to navigate back to Order Summary. */
  async pressBack(): Promise<void> {
    await this.driver.pressKeyCode(4);
    await this.driver.pause(2000);
  }
}
