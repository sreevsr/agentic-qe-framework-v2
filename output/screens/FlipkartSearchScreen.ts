import { BaseScreen } from '../core/base-screen';

export class FlipkartSearchScreen extends BaseScreen {
  constructor(driver: WebdriverIO.Browser) {
    super(driver, 'flipkart-search-screen');
  }

  /** Wait for search input EditText to appear. */
  async waitForScreen(): Promise<void> {
    await this.waitForElement('searchInput', 'displayed', 10000);
  }

  /** Type a search query and press Enter to submit. */
  async searchFor(query: string): Promise<void> {
    const el = await this.loc.get('searchInput');
    await el.setValue(query);
    await this.driver.pause(1000);
    await this.driver.pressKeyCode(66); // KEYCODE_ENTER
  }

  /**
   * Tap a search suggestion whose text contains the given keyword.
   * The app reorders query words in suggestions — use a stable keyword subset.
   *
   * FIX: textContains() matches the EditText itself (because the typed query contains
   * the keyword). Use className filter to exclude EditText — suggestions are TextViews.
   * Also hide keyboard after tap to prevent scroll gestures from triggering glide typing.
   */
  async tapSuggestion(keyword: string): Promise<void> {
    const suggestion = await this.driver.$(
      `android=new UiSelector().className("android.widget.TextView").textContains("${keyword}")`
    );
    await suggestion.waitForExist({ timeout: 10000 });
    await suggestion.click();
    await this.driver.pause(2000);
    // CRITICAL: Hide keyboard to prevent subsequent swipe gestures from triggering
    // GBoard's glide typing (which injects text into the search bar).
    try { await this.driver.hideKeyboard(); } catch { /* keyboard may be closed already */ }
    await this.driver.pause(1000);
  }
}
