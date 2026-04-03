/**
 * popup-dismisser.ts — Reactive-only popup/overlay handling for the replay engine.
 *
 * Strategy: Plan-Driven + Reactive
 *   - PROACTIVE dismissal is REMOVED. The Plan Generator detects popups during
 *     exploration and records them as explicit steps in the plan.json. The replay
 *     engine executes those steps like any other — traceable, auditable, healable.
 *   - PRE-ACTION overlay check: lightweight check before every ACTION step (~5ms).
 *     If a full-screen overlay is blocking the viewport, attempt to dismiss it.
 *   - REACTIVE retry: if a step fails with "obscured" or "intercepted", attempt
 *     overlay dismissal and retry the step once.
 *
 * Browser-level popups (notifications, permissions, JS dialogs) are handled
 * at Playwright context configuration level, not here.
 */

import { Page } from 'playwright';

export interface DismissResult {
  dismissed: string[];
  timeSpent: number;
}

/**
 * PRE-ACTION overlay check — runs before every ACTION step.
 *
 * Lightweight: single page.evaluate() call (~5-10ms on enterprise apps).
 * Checks if a fixed/absolute-positioned element covers >50% of the viewport.
 * If detected, attempts to dismiss it by pressing Escape or clicking a close button.
 *
 * Does NOT flag elements inside [role="dialog"] or [role="complementary"] —
 * those are intentional app UI (modals, panels, drawers).
 */
export async function checkAndDismissOverlay(page: Page): Promise<DismissResult> {
  const start = Date.now();

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

  if (!hasOverlay) {
    return { dismissed: [], timeSpent: 0 };
  }

  // Overlay detected — try Escape key first (works for most overlays/ads)
  const dismissed: string[] = [];
  try {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    dismissed.push('Overlay: pressed Escape');
  } catch {
    // Escape failed — not critical
  }

  return {
    dismissed,
    timeSpent: Date.now() - start,
  };
}

/**
 * Check if a step failure looks like an overlay/obstruction issue.
 * Used for REACTIVE dismissal — when a step fails, check if the error
 * indicates an element was obscured, then retry once.
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
