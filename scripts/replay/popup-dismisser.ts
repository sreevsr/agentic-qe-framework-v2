/**
 * popup-dismisser.ts — Built-in popup/overlay dismissal for the replay engine.
 *
 * Runs after every navigation and after actions that trigger page changes.
 * Handles: cookie banners, browser dialogs, overlay ads, marketing modals.
 *
 * Browser-level popups (notifications, permissions, JS dialogs) are handled
 * at Playwright context configuration level, not here.
 */

import { Page } from 'playwright';

export interface DismissResult {
  dismissed: string[];
  timeSpent: number;
}

// Common button texts for cookie/consent banners (case-insensitive matching)
const COOKIE_BUTTON_TEXTS = [
  'Accept All',
  'Accept Cookies',
  'Accept',
  'Allow All',
  'I Agree',
  'I Accept',
  'Got It',
  'OK',
  'Agree',
  'Allow',
  'Continue',
  'Understood',
];

// Common dismiss/close button texts for modals and overlays
const DISMISS_BUTTON_TEXTS = [
  'Close',
  'No Thanks',
  'No, Thanks',
  'Not Now',
  'Maybe Later',
  'Dismiss',
  'Skip',
];

// Common close button selectors (X buttons, close icons)
const CLOSE_BUTTON_SELECTORS = [
  '[aria-label="Close"]',
  '[aria-label="close"]',
  '[aria-label="Dismiss"]',
  'button.close',
  '.modal-close',
  '.popup-close',
  '.overlay-close',
];

/**
 * Attempt to dismiss any visible popups, banners, or overlays.
 * Returns what was dismissed (for reporting).
 *
 * Designed to be fast — short timeouts, fails silently.
 */
export async function dismissPopups(page: Page): Promise<DismissResult> {
  const start = Date.now();
  const dismissed: string[] = [];

  // 1. Cookie/consent banners — try common accept buttons
  for (const buttonText of COOKIE_BUTTON_TEXTS) {
    try {
      const btn = page.getByRole('button', { name: buttonText, exact: false });
      if (await btn.isVisible({ timeout: 500 }).catch(() => false)) {
        await btn.click({ timeout: 2000 });
        dismissed.push(`Cookie banner: clicked "${buttonText}"`);
        // Wait briefly for the banner to animate away
        await page.waitForTimeout(300);
        break; // Only click one consent button
      }
    } catch {
      continue;
    }
  }

  // 2. Marketing/newsletter modals — try dismiss buttons
  for (const buttonText of DISMISS_BUTTON_TEXTS) {
    try {
      const btn = page.getByRole('button', { name: buttonText, exact: false });
      if (await btn.isVisible({ timeout: 300 }).catch(() => false)) {
        await btn.click({ timeout: 2000 });
        dismissed.push(`Modal: clicked "${buttonText}"`);
        await page.waitForTimeout(300);
        break;
      }
    } catch {
      continue;
    }
  }

  // 3. Close buttons (X icons) on overlays
  for (const selector of CLOSE_BUTTON_SELECTORS) {
    try {
      const btn = page.locator(selector).first();
      if (await btn.isVisible({ timeout: 300 }).catch(() => false)) {
        await btn.click({ timeout: 2000 });
        dismissed.push(`Overlay: closed via ${selector}`);
        await page.waitForTimeout(300);
        break;
      }
    } catch {
      continue;
    }
  }

  // 4. Google ad vignettes (interstitial ads with #google_vignette hash)
  try {
    const url = page.url();
    if (url.includes('#google_vignette')) {
      // Try to find and click a close/dismiss button in the ad iframe
      const adCloseBtn = page.locator('iframe').first()
        .contentFrame()
        .locator('[aria-label="Close"], .close-button, #dismiss-button')
        .first();

      if (await adCloseBtn.isVisible({ timeout: 500 }).catch(() => false)) {
        await adCloseBtn.click({ timeout: 2000 });
        dismissed.push('Google ad vignette: closed');
        await page.waitForTimeout(500);
      } else {
        // Fallback: press Escape
        await page.keyboard.press('Escape');
        dismissed.push('Google ad vignette: pressed Escape');
        await page.waitForTimeout(500);
      }
    }
  } catch {
    // Ad dismissal failed — not critical
  }

  return {
    dismissed,
    timeSpent: Date.now() - start,
  };
}

/**
 * Configure browser-level popup handling on a Playwright context.
 * Call this ONCE when creating the browser context.
 */
export function configureBrowserPopupHandling(page: Page): void {
  // Auto-dismiss JavaScript dialogs (alert, confirm, prompt)
  page.on('dialog', async (dialog) => {
    await dialog.dismiss().catch(() => {});
  });
}

/**
 * Get recommended browser context options for popup suppression.
 */
export function getPopupSuppressingContextOptions(): Record<string, any> {
  return {
    permissions: [],        // Deny all permission prompts (camera, location, notifications)
    acceptDownloads: true,  // Allow file downloads
    bypassCSP: false,       // Don't bypass Content Security Policy
  };
}
