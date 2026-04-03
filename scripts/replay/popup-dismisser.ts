/**
 * popup-dismisser.ts — Built-in popup/overlay dismissal for the replay engine.
 *
 * Strategy: Option D+ (Navigation + Reactive)
 *   1. PROACTIVE dismissal: runs after NAVIGATE steps only (cookie banners, consent modals, ads)
 *   2. PRE-ACTION overlay check: lightweight check before every ACTION step (~5ms)
 *      If a full-screen overlay is detected, dismiss it before attempting the action.
 *   3. REACTIVE dismissal: if a step fails with "obscured" or "intercepted", dismiss + retry once.
 *
 * Never runs proactive dismissal after ACTION steps — avoids closing intentional
 * panels/dialogs (Fluent UI Panels, MUI Drawers, etc.) that the action opened.
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
 * PROACTIVE dismissal — runs after NAVIGATE steps only.
 *
 * Attempts to dismiss cookie banners, consent modals, marketing popups,
 * and ad overlays. Designed to be fast — short timeouts, fails silently.
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
  //    Skip buttons inside [role="dialog"] or [role="complementary"] — those are
  //    typically intentional app UI (panels, drawers), not unwanted popups.
  for (const buttonText of DISMISS_BUTTON_TEXTS) {
    try {
      const btn = page.getByRole('button', { name: buttonText, exact: false });
      if (await btn.isVisible({ timeout: 300 }).catch(() => false)) {
        // Check if this button is inside a dialog/complementary — if so, skip it
        const insideDialog = await btn.evaluate((el) => {
          let parent = el.parentElement;
          while (parent) {
            const role = parent.getAttribute('role');
            if (role === 'dialog' || role === 'complementary' || role === 'alertdialog') {
              return true;
            }
            parent = parent.parentElement;
          }
          return false;
        }).catch(() => false);

        if (insideDialog) continue;

        await btn.click({ timeout: 2000 });
        dismissed.push(`Modal: clicked "${buttonText}"`);
        await page.waitForTimeout(300);
        break;
      }
    } catch {
      continue;
    }
  }

  // 3. Close buttons (X icons) on overlays — same dialog check
  for (const selector of CLOSE_BUTTON_SELECTORS) {
    try {
      const btn = page.locator(selector).first();
      if (await btn.isVisible({ timeout: 300 }).catch(() => false)) {
        const insideDialog = await btn.evaluate((el) => {
          let parent = el.parentElement;
          while (parent) {
            const role = parent.getAttribute('role');
            if (role === 'dialog' || role === 'complementary' || role === 'alertdialog') {
              return true;
            }
            parent = parent.parentElement;
          }
          return false;
        }).catch(() => false);

        if (insideDialog) continue;

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
 * PRE-ACTION overlay check — runs before every ACTION step.
 *
 * Lightweight: single page.evaluate() call (~5-10ms on enterprise apps).
 * Checks if a fixed/absolute-positioned element covers >50% of the viewport.
 * If detected, runs full dismissPopups() to clear it before the action proceeds.
 *
 * Does NOT flag elements inside [role="dialog"] or [role="complementary"] —
 * those are intentional app UI (modals, panels, drawers).
 */
export async function checkAndDismissOverlay(page: Page): Promise<DismissResult> {
  const hasOverlay = await page.evaluate(() => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const viewportArea = vw * vh;
    const candidates = document.querySelectorAll('*');
    for (const el of candidates) {
      const style = window.getComputedStyle(el);
      if (style.position !== 'fixed' && style.position !== 'absolute') continue;
      if (style.display === 'none' || style.visibility === 'hidden') continue;
      // Skip elements inside intentional app dialogs/panels
      let parent: Element | null = el;
      let insideDialog = false;
      while (parent) {
        const role = parent.getAttribute('role');
        if (role === 'dialog' || role === 'complementary' || role === 'alertdialog') {
          insideDialog = true;
          break;
        }
        parent = parent.parentElement;
      }
      if (insideDialog) continue;
      const rect = el.getBoundingClientRect();
      if (rect.width * rect.height > viewportArea * 0.5) return true;
    }
    return false;
  }).catch(() => false);

  if (hasOverlay) {
    return dismissPopups(page);
  }

  return { dismissed: [], timeSpent: 0 };
}

/**
 * Check if a step failure looks like an overlay/obstruction issue.
 * Used for REACTIVE dismissal — when a step fails, check if the error
 * indicates an element was obscured, then dismiss + retry.
 */
export function isOverlayError(errorMessage: string): boolean {
  const patterns = [
    'element is not visible',
    'element is obscured',
    'intercept',
    'another element would receive',
    'click intercepted',
    'pointer-events',
    'element is outside of the viewport',
  ];
  const lower = errorMessage.toLowerCase();
  return patterns.some(p => lower.includes(p));
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
