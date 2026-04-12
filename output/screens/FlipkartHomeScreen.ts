import { BaseScreen } from '../core/base-screen';
import { PopupGuard, FLIPKART_PATTERNS } from '../core/popup-guard';

export class FlipkartHomeScreen extends BaseScreen {
  public guard: PopupGuard;

  constructor(driver: WebdriverIO.Browser) {
    super(driver, 'flipkart-home-screen');
    this.guard = new PopupGuard(driver);
    this.guard.addPatterns(FLIPKART_PATTERNS);
  }

  /** Wait for home screen to be ready. Dismisses overlays first. */
  async waitForScreen(): Promise<void> {
    await this.guard.dismiss();
    await this.waitForElement('cartTab', 'displayed', 20000);
  }

  /** Tap the search bar using coordinate tap (no stable selector — desc rotates). */
  async tapSearchBar(): Promise<void> {
    await this.guard.dismiss();
    // Search bar has rotating content-desc. Coordinate tap is the reliable strategy.
    // Position is stable at approximately (300, 348) on 720x1600 screen.
    await this.driver.action('pointer')
      .move({ duration: 0, origin: 'viewport', x: 300, y: 348 })
      .down({ button: 0 }).pause(100).up({ button: 0 }).perform();
  }

  /** Navigate to Cart via bottom tab. */
  async tapCartTab(): Promise<void> {
    await this.tap('cartTab');
  }

  /** Check if we're on the home screen (Cart tab visible in bottom nav). */
  async isOnHomeScreen(): Promise<boolean> {
    return this.isVisible('cartTab');
  }

  /** Wait for home screen to be visible. Use fixed pause + single targeted check. */
  async waitForHomeScreenVisible(timeoutMs = 20000): Promise<void> {
    // PACING: App splash + initial React Native render takes ~4-6s on this device.
    // Fixed pause is FAR faster than polling XPath on a huge RN tree (each traversal = 20-30s).
    await this.driver.pause(5000);
    // Single targeted check for the bottom Cart tab (UiSelector by description — fast, indexed lookup).
    await this.waitForElement('cartTab', 'displayed', timeoutMs);
  }

  /** Verify the top nav tab row is present. Returns 4 if home screen loaded, 0 otherwise. */
  async getNavTabImageCount(): Promise<number> {
    // FIX: Never scan the entire RN tree with //android.widget.ImageView — that's 20-30s per call
    //      on Flipkart. Use the targeted deliveryAddress locator (which only exists on home) as proxy.
    try {
      const deliveryAddrVisible = await this.isVisible('deliveryAddress');
      return deliveryAddrVisible ? 4 : 0;
    } catch {
      return 0;
    }
  }

  /** Get delivery address text shown below nav tabs (truncated in UI). */
  async getDeliveryAddressText(): Promise<string> {
    try {
      // PACING: delivery address is dynamic content (user profile API), loads after static tab images
      await this.waitForElement('deliveryAddress', 'displayed', 15000);
      return await this.getText('deliveryAddress');
    } catch {
      return '';
    }
  }

  /** Tap the Flipkart tab (top-left). Coordinate tap — no accessibility node. */
  async tapFlipkartTab(): Promise<void> {
    // FRAGILE: Coordinate tap — Flipkart tab is image-only React Native element at (105,144)
    // No guard.dismiss() here — Flipkart tab does not produce popups (enriched.md verified)
    await this.driver.action('pointer')
      .move({ duration: 0, origin: 'viewport', x: 105, y: 144 })
      .down({ button: 0 }).pause(100).up({ button: 0 }).perform();
    await this.driver.pause(2000);
  }

  /** Tap the Minutes tab. Coordinate tap — content-desc is a live countdown (unstable). */
  async tapMinutesTab(): Promise<void> {
    // FRAGILE: Minutes tab content-desc changes every second — NEVER match by text; coordinate only
    await this.driver.action('pointer')
      .move({ duration: 0, origin: 'viewport', x: 275, y: 144 })
      .down({ button: 0 }).pause(100).up({ button: 0 }).perform();
    await this.driver.pause(2000);
  }

  /** Tap the Travel tab. Coordinate tap — image-only element. */
  async tapTravelTab(): Promise<void> {
    // FRAGILE: Coordinate tap — Travel tab is image-only React Native element at (445,144)
    await this.driver.action('pointer')
      .move({ duration: 0, origin: 'viewport', x: 445, y: 144 })
      .down({ button: 0 }).pause(100).up({ button: 0 }).perform();
    await this.driver.pause(2000);
  }

  /** Tap the Grocery tab. May show promo popup — call guard.dismiss() after. */
  async tapGroceryTab(): Promise<void> {
    // FRAGILE: Coordinate tap — Grocery tab at (615,144); may trigger XtraSaver promo overlay
    await this.driver.action('pointer')
      .move({ duration: 0, origin: 'viewport', x: 615, y: 144 })
      .down({ button: 0 }).pause(100).up({ button: 0 }).perform();
    await this.driver.pause(3000);
    await this.guard.dismiss();
  }

  /** Tap the search box (home screen). Coordinate tap — placeholder text rotates. */
  async tapSearchBox(): Promise<void> {
    // FRAGILE: Coordinate tap — search box placeholder rotates (watches, mobiles, etc.); (360,340)
    await this.driver.action('pointer')
      .move({ duration: 0, origin: 'viewport', x: 360, y: 340 })
      .down({ button: 0 }).pause(100).up({ button: 0 }).perform();
    await this.driver.pause(2000);
  }
}
