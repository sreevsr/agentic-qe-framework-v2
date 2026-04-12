/**
 * PopupGuard — Resilient overlay/popup dismissal utility for mobile apps.
 *
 * Production apps show random overlays: permission dialogs, promo banners,
 * app rating requests, notification prompts, ad interstitials, sale popups.
 * Some are deterministic (permissions on first launch), some are random.
 *
 * PopupGuard runs before each critical interaction to ensure the target
 * element is not obscured by an overlay. It checks for known overlay patterns
 * and dismisses them automatically.
 *
 * Usage:
 *   const guard = new PopupGuard(browser);
 *   guard.addPattern({ name: 'promo-banner', dismissBy: 'back' });
 *   guard.addPattern({ name: 'rate-app', selectors: ['text=Not Now', 'text=Later'] });
 *   await guard.dismiss(); // Run before any interaction
 *
 * Architecture:
 *   - Patterns are ordered by priority (system dialogs first, then app overlays)
 *   - Each pattern has a detection strategy and a dismissal action
 *   - The guard is idempotent — safe to call multiple times
 *   - Logs every dismissal for debugging and app-context learning
 */

export interface PopupPattern {
  /** Human-readable name for logging */
  name: string;
  /** Priority: lower = checked first. System dialogs = 1-10, app overlays = 11-50 */
  priority?: number;
  /** Detection: list of selectors to check (any match = popup detected) */
  selectors?: string[];
  /** Detection: resource-id patterns (regex) */
  resourceIdPattern?: string;
  /** Detection: text patterns (regex, case-insensitive) */
  textPattern?: string;
  /** Dismissal action: 'tap' selector, 'back' press, or 'tap-coordinates' */
  dismissBy: 'tap' | 'back' | 'tap-coordinates';
  /** For 'tap' dismissal: selector to tap (defaults to first matching selector) */
  tapSelector?: string;
  /** For 'tap-coordinates': coordinates to tap */
  tapCoordinates?: { x: number; y: number };
  /** Maximum times to try dismissing this pattern per guard.dismiss() call */
  maxAttempts?: number;
}

/** Default patterns that apply to most Android apps */
const ANDROID_SYSTEM_PATTERNS: PopupPattern[] = [
  {
    name: 'android-location-permission',
    priority: 1,
    resourceIdPattern: 'permission_message',
    selectors: ['id=com.android.permissioncontroller:id/permission_allow_one_time_button'],
    dismissBy: 'tap',
    tapSelector: 'id=com.android.permissioncontroller:id/permission_deny_button',
  },
  {
    name: 'android-notification-permission',
    priority: 2,
    textPattern: 'send you notifications',
    selectors: ['id=com.android.permissioncontroller:id/permission_allow_button'],
    dismissBy: 'tap',
    tapSelector: 'id=com.android.permissioncontroller:id/permission_deny_button',
  },
  {
    name: 'android-allow-permission-generic',
    priority: 3,
    resourceIdPattern: 'permission_',
    dismissBy: 'tap',
    tapSelector: 'id=com.android.permissioncontroller:id/permission_deny_button',
  },
  {
    name: 'google-play-update',
    priority: 5,
    textPattern: 'Update available|Update now',
    dismissBy: 'back',
  },
];

export class PopupGuard {
  private patterns: PopupPattern[] = [];
  private dismissLog: { name: string; timestamp: number }[] = [];

  constructor(
    private driver: WebdriverIO.Browser,
    /** If true, include default Android system patterns */
    includeSystemPatterns = true,
  ) {
    if (includeSystemPatterns) {
      this.patterns.push(...ANDROID_SYSTEM_PATTERNS);
    }
  }

  /** Add a custom popup pattern for the app under test. */
  addPattern(pattern: PopupPattern): void {
    if (!pattern.priority) pattern.priority = 20;
    if (!pattern.maxAttempts) pattern.maxAttempts = 2;
    this.patterns.push(pattern);
    // Keep sorted by priority
    this.patterns.sort((a, b) => (a.priority || 20) - (b.priority || 20));
  }

  /** Add multiple patterns at once. */
  addPatterns(patterns: PopupPattern[]): void {
    patterns.forEach(p => this.addPattern(p));
  }

  /**
   * Check for and dismiss any visible overlays.
   * Fetches page source ONCE and checks all patterns in-memory (no per-pattern element lookups).
   * This avoids firing 13+ UiAutomator2 regex traversals — each of which takes 20s on large RN trees.
   * Returns the number of overlays dismissed.
   */
  async dismiss(): Promise<number> {
    let totalDismissed = 0;
    let rounds = 0;

    while (rounds < 5) {
      rounds++;

      // ONE page source fetch per round — all pattern matching done in-memory
      let pageSource: string;
      try {
        pageSource = await this.driver.getPageSource();
      } catch {
        break; // Can't get source — stop trying
      }

      let matched = false;
      for (const pattern of this.patterns) {
        if (this.detectPatternInSource(pattern, pageSource)) {
          await this.dismissPattern(pattern);
          totalDismissed++;
          matched = true;
          this.dismissLog.push({ name: pattern.name, timestamp: Date.now() });
          console.log(`[PopupGuard] Dismissed: ${pattern.name}`);
          await this.driver.pause(500);
          break; // Re-check from top after dismissal
        }
      }

      if (!matched) break; // No overlays found — done
    }

    return totalDismissed;
  }

  /**
   * Detect if a popup pattern matches the provided page source XML string.
   * All matching is done in-memory — zero Appium commands fired.
   */
  private detectPatternInSource(pattern: PopupPattern, pageSource: string): boolean {
    if (pattern.textPattern) {
      if (new RegExp(pattern.textPattern, 'i').test(pageSource)) return true;
    }
    if (pattern.resourceIdPattern) {
      if (pageSource.includes(pattern.resourceIdPattern)) return true;
    }
    if (pattern.selectors) {
      for (const selector of pattern.selectors) {
        // Extract the text/id value from selector strings for source matching
        const idMatch = selector.match(/id=([^\s]+)/);
        if (idMatch && pageSource.includes(idMatch[1])) return true;
        const textMatch = selector.match(/text=["']?([^"']+)/);
        if (textMatch && pageSource.toLowerCase().includes(textMatch[1].toLowerCase())) return true;
      }
    }
    return false;
  }

  /** Execute the dismissal action for a pattern. */
  private async dismissPattern(pattern: PopupPattern): Promise<void> {
    try {
      switch (pattern.dismissBy) {
        case 'tap':
          if (pattern.tapSelector) {
            const el = await this.driver.$(pattern.tapSelector);
            if (await el.isExisting()) {
              await el.click();
              return;
            }
          }
          // Fall back to tapping the first detection selector
          if (pattern.selectors) {
            for (const selector of pattern.selectors) {
              const el = await this.driver.$(selector);
              if (await el.isExisting()) {
                await el.click();
                return;
              }
            }
          }
          // Last resort — press back
          await this.driver.back();
          break;

        case 'back':
          await this.driver.back();
          break;

        case 'tap-coordinates':
          if (pattern.tapCoordinates) {
            await this.driver.action('pointer')
              .move({ duration: 0, origin: 'viewport', x: pattern.tapCoordinates.x, y: pattern.tapCoordinates.y })
              .down({ button: 0 })
              .pause(100)
              .up({ button: 0 })
              .perform();
          }
          break;
      }
    } catch (err) {
      console.log(`[PopupGuard] Dismissal failed for ${pattern.name}: ${(err as Error).message.substring(0, 100)}`);
    }
  }

  /** Get the log of all dismissed popups (useful for app-context learning). */
  getDismissLog(): { name: string; timestamp: number }[] {
    return this.dismissLog;
  }

  /** Reset the dismiss log. */
  resetLog(): void {
    this.dismissLog = [];
  }
}

/**
 * Pre-built Flipkart popup patterns.
 * Add to PopupGuard: guard.addPatterns(FLIPKART_PATTERNS)
 */
export const FLIPKART_PATTERNS: PopupPattern[] = [
  {
    name: 'flipkart-location-permission',
    priority: 1,
    textPattern: 'Allow Flipkart to access',
    dismissBy: 'tap',
    tapSelector: 'id=com.android.permissioncontroller:id/permission_allow_one_time_button',
  },
  {
    name: 'flipkart-notification-permission',
    priority: 2,
    textPattern: 'send you notifications',
    dismissBy: 'tap',
    tapSelector: 'id=com.android.permissioncontroller:id/permission_allow_button',
  },
  {
    name: 'flipkart-promo-bottom-sheet',
    priority: 10,
    resourceIdPattern: 'design_bottom_sheet',
    dismissBy: 'back',
  },
  {
    name: 'flipkart-sale-overlay',
    priority: 11,
    textPattern: 'Shop now|Shop Now|SHOP NOW',
    dismissBy: 'back',
  },
  {
    name: 'flipkart-app-rating',
    priority: 12,
    textPattern: 'Rate us|Rate Flipkart|Enjoying Flipkart',
    dismissBy: 'tap',
    tapSelector: 'android=new UiSelector().textMatches("(?i)not now|later|no thanks|maybe later")',
  },
  {
    name: 'flipkart-login-prompt',
    priority: 13,
    textPattern: 'Login to get the best|Sign in for best',
    dismissBy: 'back',
  },
  {
    name: 'flipkart-notification-prompt',
    priority: 14,
    textPattern: 'Turn on notifications|Enable notifications|Never miss',
    dismissBy: 'tap',
    tapSelector: 'android=new UiSelector().textMatches("(?i)not now|skip|no thanks|later")',
  },
  {
    name: 'flipkart-truecaller-sheet',
    priority: 15,
    resourceIdPattern: 'com.truecaller',
    dismissBy: 'tap',
    tapSelector: 'id=com.truecaller:id/tv_continueWithDifferentNumber',
  },
  {
    name: 'generic-close-button',
    priority: 50,
    selectors: [
      'android=new UiSelector().descriptionMatches("(?i)close|dismiss")',
      'android=new UiSelector().textMatches("(?i)^x$|^✕$|^close$")',
    ],
    dismissBy: 'tap',
  },
];
