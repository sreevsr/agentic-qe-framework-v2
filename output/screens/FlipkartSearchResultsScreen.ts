import { BaseScreen } from '../core/base-screen';

export class FlipkartSearchResultsScreen extends BaseScreen {
  constructor(driver: WebdriverIO.Browser) {
    super(driver, 'flipkart-search-results-screen');
  }

  /**
   * Dismiss any popups that appear on the search results screen.
   * Flipkart shows notification and location permission popups in sequence.
   */
  async dismissPopups(): Promise<void> {
    for (let i = 0; i < 3; i++) {
      try {
        const notNow = await this.loc.get('notNowButton');
        if (await notNow.isDisplayed()) {
          await notNow.click();
          await this.driver.pause(1000);
          continue;
        }
      } catch { /* no popup */ }
      break;
    }
  }

  /** Wait for search results to load. Dismisses popups that may appear. */
  async waitForResults(timeout = 15000): Promise<void> {
    await this.driver.pause(3000);
    await this.dismissPopups();
    // FIX: Use resultsScrollView (generic RecyclerView container) instead of firstProductTitle.
    // firstProductTitle uses a hardcoded brand ("boAt") that doesn't match this search query.
    // resultsScrollView appears whenever any search results load — query-agnostic.
    await this.waitForElement('resultsScrollView', 'displayed', timeout);
  }

  /** Tap the first product in results. */
  async tapFirstProduct(): Promise<void> {
    await this.dismissPopups();
    await this.tap('firstProductTitle');
  }

  /** Check if results are visible. */
  async isResultsVisible(): Promise<boolean> {
    return this.isVisible('firstProductTitle');
  }

  /**
   * Scroll down (swipe up) until a product with the given keyword is visible.
   * Safety limit: maxScrolls swipes before giving up.
   * DISCOVERED: LUKZER appears after ~2 scroll-down gestures.
   */
  async scrollToFindProduct(keyword: string, maxScrolls = 10): Promise<void> {
    for (let i = 0; i < maxScrolls; i++) {
      try {
        const el = await this.driver.$(`android=new UiSelector().textContains("${keyword}")`);
        if (await el.isExisting() && await el.isDisplayed()) return;
      } catch { /* element not visible yet */ }
      await this.swipe('up'); // swipe up = scroll down
      await this.driver.pause(1500);
    }
    // Final check — throw if still not found
    const el = await this.driver.$(`android=new UiSelector().textContains("${keyword}")`);
    await el.waitForExist({ timeout: 5000 });
  }

  /**
   * Tap the first product card whose text contains the given keyword.
   */
  async tapProductByKeyword(keyword: string): Promise<void> {
    const el = await this.driver.$(`android=new UiSelector().textContains("${keyword}")`);
    await el.waitForExist({ timeout: 10000 });
    await el.click();
    await this.driver.pause(3000);
  }

  /**
   * Tap the cart icon in the top-right header. Coordinate tap — no stable resource-id.
   */
  async tapCartIcon(): Promise<void> {
    // FRAGILE: Coordinate tap — cart icon at (653,140) on 720×1600 screen; no stable resource-id
    await this.driver.action('pointer')
      .move({ duration: 0, origin: 'viewport', x: 653, y: 140 })
      .down({ button: 0 }).pause(100).up({ button: 0 }).perform();
    await this.driver.pause(3000);
  }
}
