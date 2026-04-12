import { BaseScreen } from '../core/base-screen';

export class FlipkartCartScreen extends BaseScreen {
  constructor(driver: WebdriverIO.Browser) {
    super(driver, 'flipkart-cart-screen');
  }

  /** Wait for cart screen to load. */
  async waitForScreen(): Promise<void> {
    await this.driver.pause(2000);
    await this.waitForElement('cartHeader', 'displayed', 15000);
  }

  /** Get the cart header text (e.g., "Cart (1 item)"). */
  async getCartHeader(): Promise<string> {
    return this.getText('cartHeader');
  }

  /** Check if cart has priced items. */
  async hasItems(): Promise<boolean> {
    return this.isVisible('cartItemPrice');
  }

  /** Get the first item price. */
  async getFirstItemPrice(): Promise<string> {
    try { return await this.getText('cartItemPrice'); } catch { return ''; }
  }

  /** Check if Place Order button is visible. */
  async isPlaceOrderVisible(): Promise<boolean> {
    return this.isVisible('placeOrderButton');
  }

  /**
   * Check if a product with the given keyword is visible in the cart.
   * Scoped to the Flipkart tab (DISCOVERED: LUKZER appears in Flipkart tab only).
   */
  async isProductVisible(keyword: string): Promise<boolean> {
    try {
      const el = await this.driver.$(`android=new UiSelector().textContains("${keyword}")`);
      return await el.isExisting() && await el.isDisplayed();
    } catch {
      return false;
    }
  }

  /**
   * Tap the Remove button next to the product being removed.
   * DISCOVERED: Immediate removal — no confirmation dialog shown.
   */
  async tapRemoveButton(): Promise<void> {
    await this.tap('removeButton');
    await this.driver.pause(2000);
  }

  /**
   * Verify a product is no longer in the cart (absent check).
   * Returns true if the element is NOT found (i.e., product was removed).
   */
  async isProductAbsent(keyword: string): Promise<boolean> {
    try {
      const el = await this.driver.$(`android=new UiSelector().textContains("${keyword}")`);
      const exists = await el.isExisting();
      return !exists;
    } catch {
      return true; // element not found = absent = expected
    }
  }

  /**
   * Tap the Home button in the bottom navigation bar.
   * DISCOVERED: Bottom nav shows Home, Play, Categories, Account, Cart.
   */
  async tapHomeNavButton(): Promise<void> {
    await this.tap('homeNavButton');
    await this.driver.pause(2000);
  }
}
