import { BaseScreen } from '../core/base-screen';

export class OrderSummaryScreen extends BaseScreen {
  constructor(driver: WebdriverIO.Browser) {
    super(driver, 'order-summary-screen');
  }

  /**
   * Wait for Order Summary screen to load.
   * DISCOVERED: Screen title is "Order Summary" in action bar (resource-id title_action_bar).
   * Address selection screen is SKIPPED when a default HOME address is configured.
   */
  async waitForScreen(timeoutMs = 15000): Promise<void> {
    await this.driver.pause(2000);
    await this.waitForElement('screenTitle', 'displayed', timeoutMs);
  }

  /**
   * Get the delivery address text displayed on the Order Summary screen.
   * DISCOVERED: Auto-selected HOME address; full address is multi-line text block.
   */
  async getDeliveryAddressText(): Promise<string> {
    return this.getText('confirmedDeliveryAddress');
  }

  /**
   * Check whether a delivery address containing the given text is visible.
   * Used to verify the pre-selected HOME address is displayed.
   */
  async isAddressVisible(addressSubstring: string): Promise<boolean> {
    try {
      const el = await this.driver.$(`android=new UiSelector().textContains("${addressSubstring}")`);
      return await el.isExisting() && await el.isDisplayed();
    } catch {
      return false;
    }
  }

  /**
   * Tap the Continue button to proceed to the Payments screen.
   * DISCOVERED: content-desc = "Continue " (with trailing space); UiSelector.text("Continue") FAILS.
   */
  async tapContinue(): Promise<void> {
    await this.tap('continueButton');
    await this.driver.pause(4000);
  }

  /**
   * Press Android BACK key to navigate back.
   * DISCOVERED: Pressing back from Order Summary navigates to Search Results
   * (address screen was not in forward stack when HOME address was auto-selected).
   */
  async pressBack(): Promise<void> {
    await this.driver.pressKeyCode(4);
    await this.driver.pause(2000);
  }
}
