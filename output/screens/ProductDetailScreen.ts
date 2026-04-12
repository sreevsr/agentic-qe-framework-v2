import { BaseScreen } from '../core/base-screen';

export class ProductDetailScreen extends BaseScreen {
  constructor(driver: WebdriverIO.Browser) {
    super(driver, 'flipkart-product-detail-screen');
  }

  /** Wait for product detail page to load — scroll down to reveal product name below carousel. */
  async waitForScreen(): Promise<void> {
    await this.driver.pause(2000);
    await this.scrollDownToContent();
    await this.waitForElement('productName', 'displayed', 15000);
  }

  /**
   * Scroll down once to bring product name and description into viewport.
   * DISCOVERED: productName is below the image carousel on initial load.
   */
  async scrollDownToContent(): Promise<void> {
    await this.swipe('up'); // swipe up = scroll down
    await this.driver.pause(1500);
  }

  /**
   * Scroll back up to reveal the image carousel (above product name).
   * DISCOVERED: Call before taking carousel screenshots.
   */
  async scrollUpToCarousel(): Promise<void> {
    await this.swipe('down'); // swipe down = scroll up
    await this.driver.pause(1500);
  }

  /** Get the full product name displayed below the image carousel. */
  async getProductName(): Promise<string> {
    return this.getText('productName');
  }

  /** Get the short product description line below the product name. */
  async getProductDescription(): Promise<string> {
    return this.getText('productDescription');
  }

  /**
   * Get the current selling price (e.g. '₹18,979').
   * Matches pattern ₹N,NNN — instance(0) returns selling price, not MRP.
   */
  async getProductPrice(): Promise<string> {
    try {
      return await this.getText('productPrice');
    } catch {
      return '';
    }
  }

  /**
   * Get the discount percentage badge (e.g. '68%').
   * Matches pattern N% — instance(0) returns primary discount displayed in price row.
   */
  async getDiscountPercentage(): Promise<string> {
    try {
      return await this.getText('discountPercentage');
    } catch {
      return '';
    }
  }

  /**
   * Swipe left on the product photo carousel to advance to the next photo.
   * DISCOVERED: 6 photos total; carousel wraps after photo 6 → photo 1.
   * startX=540, endX=180 at y=600 (center of carousel on 720×1600 screen).
   */
  async swipeCarouselLeft(): Promise<void> {
    // FRAGILE: Coordinate swipe — carousel has no stable accessibility selectors
    await this.driver.action('pointer')
      .move({ duration: 0, origin: 'viewport', x: 540, y: 600 })
      .down({ button: 0 })
      .move({ duration: 300, origin: 'viewport', x: 180, y: 600 })
      .up({ button: 0 })
      .perform();
    await this.driver.pause(1000);
  }

  /**
   * Tap the "Buy at" button at the bottom right of the screen.
   * DISCOVERED: Triggers "Frequently Bought Together" bottom sheet — not direct checkout.
   */
  async tapBuyAtButton(): Promise<void> {
    try {
      await this.tap('buyAtButton');
    } catch {
      // FRAGILE: Fallback to coordinate tap at (550,1460) if descriptionContains fails
      await this.driver.action('pointer')
        .move({ duration: 0, origin: 'viewport', x: 550, y: 1460 })
        .down({ button: 0 }).pause(100).up({ button: 0 }).perform();
    }
    await this.driver.pause(3000);
  }
}
