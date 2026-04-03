/**
 * popup-dismisser.ts — Reactive-only popup/overlay handling for the replay engine.
 *
 * Strategy: Plan-Driven + Reactive
 *   - PROACTIVE dismissal is REMOVED. The Plan Generator detects popups during
 *     exploration and records them as explicit steps in the plan.json. The replay
 *     engine executes those steps like any other — traceable, auditable, healable.
 *   - PRE-ACTION overlay check (OPT-IN): lightweight check before every ACTION step
 *     (~5ms). Disabled by default. Enable via framework-config.json:
 *       { "pipeline": { "overlayCheckBeforeActions": true } }
 *     Only needed for public-facing apps where mid-test ad overlays are a real risk.
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
 * PRE-ACTION overlay check — opt-in, runs before ACTION steps when enabled.
 *
 * Lightweight: single page.evaluate() call (~5-10ms on enterprise apps).
 * Checks if a fixed/absolute-positioned element covers >50% of the viewport.
 * If detected, attempts to dismiss it by pressing Escape.
 *
 * Excludes:
 *   - Elements inside [role="dialog"], [role="complementary"], [role="alertdialog"]
 *   - Elements inside interactive widgets (listbox, combobox, menu, tree)
 *   - Elements CONTAINING interactive widgets or data grids (Fluent UI Callout
 *     wrappers, ms-ScrollablePane containers) — these carry no ARIA role themselves
 *     but contain role="grid", role="listbox", etc.
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
      // Skip elements inside intentional app dialogs/panels AND interactive popups
      let parent: Element | null = el;
      let insideDialog = false;
      while (parent) {
        const role = parent.getAttribute('role');
        if (
          role === 'dialog' ||
          role === 'complementary' ||
          role === 'alertdialog' ||
          role === 'listbox' ||
          role === 'combobox' ||
          role === 'menu' ||
          role === 'menubar' ||
          role === 'tree' ||
          role === 'treegrid'
        ) {
          insideDialog = true;
          break;
        }
        parent = parent.parentElement;
      }
      if (insideDialog) continue;
      // Also skip if the element CONTAINS an interactive popup (Fluent UI Callout wrappers
      // are ancestors of [role=listbox/menu] but carry no role themselves).
      // Also skip data grid scroll containers (ms-ScrollablePane) — they are app content,
      // not overlays. Pressing Escape to dismiss them closes open dropdowns on the page.
      if (el.querySelector('[role="listbox"],[role="menu"],[role="tree"],[role="combobox"],[role="option"],[role="menuitem"],[role="grid"],[role="row"],[role="rowgroup"]')) continue;
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
