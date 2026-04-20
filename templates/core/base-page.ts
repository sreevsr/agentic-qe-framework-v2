import { Page, Locator, test } from '@playwright/test';
import { LocatorLoader } from './locator-loader';

/**
 * BasePage — Foundation for all page objects in the Agentic QE Framework v2.
 *
 * Every generated page object extends this class. It provides:
 * - LocatorLoader integration for externalized selectors
 * - Common interaction methods with Playwright auto-waiting
 * - Screenshot and navigation utilities
 *
 * NOTE: UI framework-specific helpers (Fluent UI, MUI, Kendo, Ant Design, etc.)
 * are NOT in this file. In v2, the Explorer/Builder discovers component interaction
 * patterns live and writes them directly to page objects. For recurring patterns,
 * teams create *.helpers.ts files. For reference patterns, see
 * templates/core/component-patterns.md.
 */
export class BasePage {
  protected page: Page;
  protected loc: LocatorLoader;

  constructor(page: Page, locatorFile: string) {
    this.page = page;
    this.loc = new LocatorLoader(page, locatorFile);
  }

  // ---------------------------------------------------------------------------
  // Navigation
  // ---------------------------------------------------------------------------

  async goto(url: string): Promise<void> {
    await this.page.goto(url, { waitUntil: 'networkidle' });
  }

  async waitForPageLoad(state: 'load' | 'domcontentloaded' | 'networkidle' = 'networkidle'): Promise<void> {
    await this.page.waitForLoadState(state);
  }

  async getCurrentUrl(): Promise<string> {
    return this.page.url();
  }

  // ---------------------------------------------------------------------------
  // Element Interactions
  // ---------------------------------------------------------------------------

  async click(elementName: string): Promise<void> {
    await this.page.locator(this.loc.get(elementName)).click();
  }

  async fill(elementName: string, value: string): Promise<void> {
    await this.page.locator(this.loc.get(elementName)).fill(value);
  }

  /**
   * Type text character by character. Use this instead of fill() when the input
   * triggers events on each keystroke (e.g., autocomplete, search, PCF filter inputs).
   * @param delay — milliseconds between keystrokes (default 0, use 50-100 for autocomplete)
   */
  async pressSequentially(elementName: string, value: string, delay: number = 0): Promise<void> {
    await this.page.locator(this.loc.get(elementName)).pressSequentially(value, { delay });
  }

  async selectOption(elementName: string, value: string): Promise<void> {
    await this.page.locator(this.loc.get(elementName)).selectOption(value);
  }

  async check(elementName: string): Promise<void> {
    await this.page.locator(this.loc.get(elementName)).check();
  }

  async uncheck(elementName: string): Promise<void> {
    await this.page.locator(this.loc.get(elementName)).uncheck();
  }

  async hover(elementName: string): Promise<void> {
    await this.page.locator(this.loc.get(elementName)).hover();
  }

  async clear(elementName: string): Promise<void> {
    await this.page.locator(this.loc.get(elementName)).clear();
  }

  // ---------------------------------------------------------------------------
  // Element Queries
  // ---------------------------------------------------------------------------

  async getText(elementName: string): Promise<string> {
    return (await this.page.locator(this.loc.get(elementName)).textContent()) ?? '';
  }

  async getInnerText(elementName: string): Promise<string> {
    return await this.page.locator(this.loc.get(elementName)).innerText();
  }

  async getInputValue(elementName: string): Promise<string> {
    return await this.page.locator(this.loc.get(elementName)).inputValue();
  }

  async getAttribute(elementName: string, attr: string): Promise<string | null> {
    return await this.page.locator(this.loc.get(elementName)).getAttribute(attr);
  }

  async isVisible(elementName: string): Promise<boolean> {
    return await this.page.locator(this.loc.get(elementName)).isVisible();
  }

  async isEnabled(elementName: string): Promise<boolean> {
    return await this.page.locator(this.loc.get(elementName)).isEnabled();
  }

  async isChecked(elementName: string): Promise<boolean> {
    return await this.page.locator(this.loc.get(elementName)).isChecked();
  }

  async getCount(elementName: string): Promise<number> {
    return await this.page.locator(this.loc.get(elementName)).count();
  }

  // ---------------------------------------------------------------------------
  // Wait Utilities
  // ---------------------------------------------------------------------------

  /**
   * Default timeout for waitForReady / isReady (milliseconds).
   * Resolution order: env override (ACTION_TIMEOUT_MS) → 30000.
   * NOTE: this is deliberately NOT read from framework-config.json at runtime —
   * BasePage has no file-system access assumption. Override via env or the
   * per-call `timeoutMs` parameter.
   */
  protected readonly defaultReadyTimeoutMs: number =
    parseInt(process.env.ACTION_TIMEOUT_MS || '', 10) || 30000;

  async waitForElement(elementName: string, state: 'visible' | 'hidden' | 'attached' | 'detached' = 'visible', timeout?: number): Promise<void> {
    await this.page.waitForSelector(this.loc.get(elementName), { state, timeout });
  }

  async waitForUrl(urlPattern: string | RegExp, timeout?: number): Promise<void> {
    await this.page.waitForURL(urlPattern, { timeout });
  }

  /**
   * Wait for an element to become visible, THROWING if it does not within the timeout.
   * Use this at the start of a page-action method to guarantee the page has rendered
   * the landmark element before proceeding.
   *
   * Prefer this over `waitForPageLoad('networkidle')` on SPAs — `networkidle` is
   * fragile on apps with analytics beacons, websockets, or polling.
   */
  async waitForReady(elementName: string, timeoutMs?: number): Promise<void> {
    await this.page.locator(this.loc.get(elementName))
      .waitFor({ state: 'visible', timeout: timeoutMs ?? this.defaultReadyTimeoutMs });
  }

  /**
   * Boolean visibility check with a BOUNDED wait. Use this for page-object
   * `is{X}Visible()` helpers — NEVER bare `locator.isVisible()` (which is a
   * synchronous snapshot and returns false the instant the element isn't painted).
   *
   * See code-generation-rules.md Section 17 for the full rule.
   */
  async isReady(elementName: string, timeoutMs?: number): Promise<boolean> {
    try {
      await this.page.locator(this.loc.get(elementName))
        .waitFor({ state: 'visible', timeout: timeoutMs ?? this.defaultReadyTimeoutMs });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Boolean hidden check with a BOUNDED wait. Returns true once the element
   * transitions to hidden/detached within the timeout, false otherwise.
   */
  async isHidden(elementName: string, timeoutMs?: number): Promise<boolean> {
    try {
      await this.page.locator(this.loc.get(elementName))
        .waitFor({ state: 'hidden', timeout: timeoutMs ?? this.defaultReadyTimeoutMs });
      return true;
    } catch {
      return false;
    }
  }

  // ---------------------------------------------------------------------------
  // Locator Access (for direct Playwright assertions in specs)
  // ---------------------------------------------------------------------------

  /**
   * Get a raw Playwright Locator for use in expect() assertions.
   * Resolves semantic prefixes (testid=, role=, etc.) via LocatorLoader.
   */
  getLocator(elementName: string): Locator {
    return this.loc.getLocator(elementName);
  }

  // ---------------------------------------------------------------------------
  // Screenshots
  // ---------------------------------------------------------------------------

  /**
   * Take a full-page screenshot and attach it to the test report.
   */
  async takeScreenshot(name: string): Promise<Buffer> {
    const screenshot = await this.page.screenshot({ fullPage: true });
    await test.info().attach(name, { body: screenshot, contentType: 'image/png' });
    return screenshot;
  }
}
