import { BaseScreen } from '../core/base-screen';

export class FlipkartProductScreen extends BaseScreen {
  constructor(driver: WebdriverIO.Browser) {
    super(driver, 'flipkart-product-screen');
  }

  /** Wait for product detail page to load (Add to Cart or Go to Cart visible). */
  async waitForScreen(): Promise<void> {
    await this.driver.pause(2000);
    // Item may already be in cart from a previous run — check both buttons
    const deadline = Date.now() + 15000;
    while (Date.now() < deadline) {
      if (await this.isVisible('addToCartButton') || await this.isVisible('goToCartButton')) return;
      await this.swipe('up');
      await this.driver.pause(1000);
    }
    // Final check
    if (!await this.isVisible('addToCartButton') && !await this.isVisible('goToCartButton')) {
      throw new Error('Neither "Add to Cart" nor "Go to Cart" found on product page');
    }
  }

  /** Tap Add to Cart. */
  async tapAddToCart(): Promise<void> {
    await this.tap('addToCartButton');
  }

  /** Tap Go to Cart (appears after Add to Cart is tapped). */
  async tapGoToCart(): Promise<void> {
    await this.waitForElement('goToCartButton', 'displayed', 5000);
    await this.tap('goToCartButton');
  }

  /** Check if Add to Cart is visible. */
  async isAddToCartVisible(): Promise<boolean> {
    return this.isVisible('addToCartButton');
  }

  /** Get the product price text. */
  async getPrice(): Promise<string> {
    try { return await this.getText('productPrice'); } catch { return ''; }
  }
}
