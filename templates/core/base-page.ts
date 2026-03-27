import { Page, Locator } from '@playwright/test';
import { LocatorLoader } from './locator-loader';

/**
 * BasePage — Foundation for all page objects in the Agentic QE Framework v2.
 *
 * Every generated page object extends this class. It provides:
 * - LocatorLoader integration for externalized selectors
 * - Common interaction methods with Playwright auto-waiting
 * - Screenshot and navigation utilities
 */
export class BasePage {
  protected page: Page;
  protected loc: LocatorLoader;

  constructor(page: Page, locatorFile: string) {
    this.page = page;
    this.loc = new LocatorLoader(page, locatorFile);
  }

  // Navigation
  async goto(url: string): Promise<void> {
    await this.page.goto(url, { waitUntil: 'networkidle' });
  }

  async waitForPageLoad(state: 'load' | 'domcontentloaded' | 'networkidle' = 'networkidle'): Promise<void> {
    await this.page.waitForLoadState(state);
  }

  async getCurrentUrl(): Promise<string> {
    return this.page.url();
  }

  // Element Interactions
  async click(elementName: string): Promise<void> {
    await this.page.locator(this.loc.get(elementName)).click();
  }

  async fill(elementName: string, value: string): Promise<void> {
    await this.page.locator(this.loc.get(elementName)).fill(value);
  }

  async pressSequentially(elementName: string, value: string): Promise<void> {
    await this.page.locator(this.loc.get(elementName)).pressSequentially(value);
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

  // Element Queries
  async getText(elementName: string): Promise<string> {
    return (await this.page.locator(this.loc.get(elementName)).textContent()) ?? '';
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

  // Wait Utilities
  async waitForElement(elementName: string, state: 'visible' | 'hidden' | 'attached' | 'detached' = 'visible', timeout?: number): Promise<void> {
    await this.page.waitForSelector(this.loc.get(elementName), { state, timeout });
  }

  async waitForUrl(urlPattern: string | RegExp, timeout?: number): Promise<void> {
    await this.page.waitForURL(urlPattern, { timeout });
  }

  // Locator Access
  getLocator(elementName: string): Locator {
    return this.page.locator(this.loc.get(elementName));
  }

  getElement(elementName: string): Locator {
    return this.page.locator(this.loc.get(elementName));
  }

  // Screenshots
  async takeScreenshot(name: string): Promise<Buffer> {
    return await this.page.screenshot({ fullPage: true });
  }
}
