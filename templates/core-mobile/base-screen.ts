import { MobileLocatorLoader } from './mobile-locator-loader';

/** Default timeout for all mobile element interactions (ms). */
const DEFAULT_TIMEOUT = 15000;

/**
 * BaseScreen — Parent class for all mobile Screen Objects.
 *
 * Provides common interaction methods that use MobileLocatorLoader
 * for automatic selector resolution with fallbacks across strategies
 * (accessibility_id > id > xpath > uiautomator/class_chain).
 *
 * Rules:
 * - Never use raw selectors (driver.$('selector')) in Screen Objects
 * - Never use driver.pause() for waiting — use waitForElement() instead
 * - All element access goes through this.loc.get('key')
 */
export class BaseScreen {
  protected loc: MobileLocatorLoader;

  constructor(
    protected driver: WebdriverIO.Browser,
    screenName: string,
  ) {
    this.loc = new MobileLocatorLoader(driver, screenName);
  }

  // ════════════════════════════════════════════════════════════════════
  // BASIC ELEMENT INTERACTIONS
  // ════════════════════════════════════════════════════════════════════

  /** Tap (click) an element by its key in the locator JSON. */
  async tap(elementKey: string): Promise<void> {
    const el = await this.loc.get(elementKey);
    await el.click();
  }

  /** Type text into an element (clears it first). Hides keyboard after typing. */
  async typeText(elementKey: string, text: string): Promise<void> {
    const el = await this.loc.get(elementKey);
    await el.clearValue();
    await el.setValue(text);
    try { await this.driver.hideKeyboard(); } catch { /* keyboard may not be open */ }
  }

  /**
   * Type text character by character with optional delay.
   * Use for fields that trigger events on each keystroke
   * (autocomplete, OTP, incremental search). Hides keyboard after typing.
   */
  async pressSequentially(elementKey: string, text: string, delay: number = 50): Promise<void> {
    const el = await this.loc.get(elementKey);
    await el.clearValue();
    for (const char of text) {
      await el.addValue(char);
      if (delay > 0) await this.driver.pause(delay);
    }
    try { await this.driver.hideKeyboard(); } catch { /* ignore */ }
  }

  /** Clear an input field. */
  async clear(elementKey: string): Promise<void> {
    const el = await this.loc.get(elementKey);
    await el.clearValue();
  }

  /** Read the current value/text of an input field. */
  async getInputValue(elementKey: string): Promise<string> {
    const el = await this.loc.get(elementKey);
    return (await el.getText()) ?? '';
  }

  /**
   * Open a native Spinner-style dropdown and pick an option by visible text.
   * Android only. For iOS picker wheels, write a screen-specific helper.
   */
  async selectOption(elementKey: string, value: string): Promise<void> {
    const spinner = await this.loc.get(elementKey);
    await spinner.click();
    await this.driver.pause(500);
    const option = await this.driver.$(`android=new UiSelector().text("${value}")`);
    await option.waitForExist({ timeout: 5000 });
    await option.click();
  }

  /** Ensure a checkbox/switch is checked (no-op if already checked). */
  async check(elementKey: string): Promise<void> {
    const el = await this.loc.get(elementKey);
    const checked = await el.getAttribute('checked');
    if (checked !== 'true') await el.click();
  }

  /** Ensure a checkbox/switch is unchecked (no-op if already unchecked). */
  async uncheck(elementKey: string): Promise<void> {
    const el = await this.loc.get(elementKey);
    const checked = await el.getAttribute('checked');
    if (checked === 'true') await el.click();
  }

  /** Returns true if the element exists and reports enabled. */
  async isEnabled(elementKey: string): Promise<boolean> {
    try {
      const el = await this.loc.get(elementKey);
      return await el.isEnabled();
    } catch {
      return false;
    }
  }

  /** Returns true if a checkbox/switch is currently checked. */
  async isChecked(elementKey: string): Promise<boolean> {
    try {
      const el = await this.loc.get(elementKey);
      return (await el.getAttribute('checked')) === 'true';
    } catch {
      return false;
    }
  }

  /**
   * Count how many elements match the locator key.
   * Uses driver.$$() with the highest-priority resolved selector for the
   * active platform — locator JSON keys intended for getCount() should use
   * a strategy that intentionally matches multiple elements.
   */
  async getCount(elementKey: string): Promise<number> {
    const platform = this.loc.getPlatform();
    const selectors = this.loc.getAllSelectors(elementKey, platform);
    if (selectors.length === 0) {
      throw new Error(`No selectors available for "${elementKey}" on platform ${platform}`);
    }
    const elements = await this.driver.$$(selectors[0]);
    return elements.length;
  }

  /** Escape hatch: return the underlying WebdriverIO element for advanced usage. */
  async getRawElement(elementKey: string) {
    return this.loc.get(elementKey);
  }

  /** Get the visible text of an element. */
  async getText(elementKey: string): Promise<string> {
    const el = await this.loc.get(elementKey);
    return (await el.getText()) ?? '';
  }

  /** Get an element attribute value. */
  async getAttribute(elementKey: string, attribute: string): Promise<string> {
    const el = await this.loc.get(elementKey);
    return (await el.getAttribute(attribute)) ?? '';
  }

  /** Check if an element is currently visible on screen. */
  async isVisible(elementKey: string): Promise<boolean> {
    try {
      const el = await this.loc.get(elementKey);
      return await el.isDisplayed();
    } catch {
      return false;
    }
  }

  /** Wait for an element to reach a specific state (retries element lookup). */
  async waitForElement(
    elementKey: string,
    state: 'displayed' | 'hidden' | 'exist' | 'not exist' = 'displayed',
    timeout = DEFAULT_TIMEOUT,
  ): Promise<void> {
    const interval = 500;
    const deadline = Date.now() + timeout;
    let lastError: Error | undefined;

    while (Date.now() < deadline) {
      try {
        const el = await this.loc.get(elementKey);
        const remaining = Math.max(deadline - Date.now(), 1000);
        switch (state) {
          case 'displayed':
            await el.waitForDisplayed({ timeout: remaining });
            return;
          case 'hidden':
            await el.waitForDisplayed({ timeout: remaining, reverse: true });
            return;
          case 'exist':
            await el.waitForExist({ timeout: remaining });
            return;
          case 'not exist':
            await el.waitForExist({ timeout: remaining, reverse: true });
            return;
        }
      } catch (err) {
        lastError = err as Error;
        if (Date.now() >= deadline) break;
        await this.driver.pause(interval);
      }
    }
    throw lastError ?? new Error(`Element "${elementKey}" did not reach state "${state}" within ${timeout}ms`);
  }

  // ════════════════════════════════════════════════════════════════════
  // NAVIGATION
  // ════════════════════════════════════════════════════════════════════

  /** Press the device back button (Android) or navigate back (iOS). */
  async goBack(): Promise<void> {
    const caps = this.driver.capabilities as Record<string, unknown>;
    const platform = (caps['platformName'] as string || '').toLowerCase();

    if (platform.includes('ios')) {
      await this.driver.executeScript('mobile: pressButton', [{ name: 'back' }]);
    } else {
      await this.driver.back();
    }
  }

  /** Press the home button. */
  async goHome(): Promise<void> {
    const caps = this.driver.capabilities as Record<string, unknown>;
    const platform = (caps['platformName'] as string || '').toLowerCase();

    if (platform.includes('ios')) {
      await this.driver.executeScript('mobile: pressButton', [{ name: 'home' }]);
    } else {
      await this.driver.pressKeyCode(3); // Android HOME
    }
  }

  // ════════════════════════════════════════════════════════════════════
  // GESTURES (W3C Actions API — NOT deprecated touchAction)
  // ════════════════════════════════════════════════════════════════════

  /** Swipe in a direction using W3C Actions API. */
  async swipe(direction: 'up' | 'down' | 'left' | 'right'): Promise<void> {
    const { width, height } = await this.driver.getWindowSize();
    const centerX = Math.round(width / 2);
    const centerY = Math.round(height / 2);

    const positions = {
      up:    { startX: centerX, startY: Math.round(height * 0.7), endX: centerX, endY: Math.round(height * 0.3) },
      down:  { startX: centerX, startY: Math.round(height * 0.3), endX: centerX, endY: Math.round(height * 0.7) },
      left:  { startX: Math.round(width * 0.8), startY: centerY, endX: Math.round(width * 0.2), endY: centerY },
      right: { startX: Math.round(width * 0.2), startY: centerY, endX: Math.round(width * 0.8), endY: centerY },
    };
    const { startX, startY, endX, endY } = positions[direction];

    await this.driver.action('pointer')
      .move({ duration: 0, origin: 'viewport', x: startX, y: startY })
      .down({ button: 0 })
      .pause(100)
      .move({ duration: 600, origin: 'viewport', x: endX, y: endY })
      .up({ button: 0 })
      .perform();
  }

  /** Scroll down until the given element key is visible (max attempts). */
  async scrollToElement(elementKey: string, direction: 'down' | 'up' = 'down', maxScrolls = 10): Promise<void> {
    for (let i = 0; i < maxScrolls; i++) {
      if (await this.isVisible(elementKey)) return;
      await this.swipe(direction);
      await this.driver.pause(300);
    }
    throw new Error(`Element "${elementKey}" not visible after ${maxScrolls} scrolls.`);
  }

  /** Long-press an element. */
  async longPress(elementKey: string, durationMs = 1500): Promise<void> {
    const el = await this.loc.get(elementKey);
    const location = await el.getLocation();
    const size = await el.getSize();
    const x = Math.round(location.x + size.width / 2);
    const y = Math.round(location.y + size.height / 2);

    await this.driver.action('pointer')
      .move({ duration: 0, origin: 'viewport', x, y })
      .down({ button: 0 })
      .pause(durationMs)
      .up({ button: 0 })
      .perform();
  }

  // ════════════════════════════════════════════════════════════════════
  // ACTIVITY (Android — replaces web waitForUrl)
  // ════════════════════════════════════════════════════════════════════

  /**
   * Wait until the current Android Activity name contains the given substring.
   * Useful for verifying navigation between screens. iOS apps have no
   * equivalent — write a screen-specific assertion using a stable element.
   */
  async waitForActivity(activityName: string, timeoutMs = 10000): Promise<void> {
    await this.driver.waitUntil(
      async () => {
        const current = await (this.driver as any).getCurrentActivity();
        return typeof current === 'string' && current.includes(activityName);
      },
      { timeout: timeoutMs, timeoutMsg: `Activity "${activityName}" not reached within ${timeoutMs}ms` },
    );
  }

  // ════════════════════════════════════════════════════════════════════
  // EVIDENCE
  // ════════════════════════════════════════════════════════════════════

  /** Take a screenshot and save it to test-results/screenshots/{name}.png */
  async takeScreenshot(name: string): Promise<string> {
    const base64 = await this.driver.takeScreenshot();
    const filePath = `test-results/screenshots/${name}.png`;

    const fs = await import('fs');
    const pathMod = await import('path');
    const dir = pathMod.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, Buffer.from(base64, 'base64'));

    return filePath;
  }

  /**
   * Record a soft-assertion failure: take a labelled screenshot and return
   * a short error message suitable for collecting in a softAssertions[] array.
   * Used by the VERIFY_SOFT keyword pattern in mobile specs.
   */
  async recordSoftFailure(label: string, err: unknown): Promise<string> {
    const safe = label.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
    try {
      await this.takeScreenshot(`VERIFY_SOFT-failed-${safe}-${Date.now()}`);
    } catch { /* screenshot best-effort */ }
    const msg = (err instanceof Error ? err.message : String(err)).substring(0, 200);
    return `VERIFY_SOFT failed: ${label} — ${msg}`;
  }
}
