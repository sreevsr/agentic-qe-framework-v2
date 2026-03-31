/**
 * element-resolver.ts — Translates plan target objects into Playwright Locator instances.
 *
 * Resolution priority:
 *   1. role + name         → page.getByRole(role, { name })
 *   2. role + nameContains → page.getByRole(role, { name: /pattern/i })
 *   3. label               → page.getByLabel(label)
 *   4. placeholder         → page.getByPlaceholder(placeholder)
 *   5. testId              → page.getByTestId(testId)
 *   6. text                → page.getByText(text)
 *   7. fallbacks[n]        → try each in order
 *
 * Scoping:
 *   - within → narrows to a container locator
 *   - frame  → switches to iframe context
 *   - nth    → disambiguates multiple matches
 */

import { Page, Locator, FrameLocator } from 'playwright';

export interface Target {
  role?: string;
  name?: string;
  nameContains?: string;
  text?: string;
  testId?: string;
  label?: string;
  placeholder?: string;
  css?: string;
  hasText?: string;
  within?: Target;
  frame?: string | { name?: string; chain?: string[] };
  nth?: number;
  fallbacks?: Target[];
}

export interface ResolveResult {
  locator: Locator;
  strategy: string; // which resolution path was used (for reporting)
}

/**
 * Resolve a target to a Playwright Locator.
 * Does NOT attempt fallbacks — use resolveWithFallbacks for that.
 */
export function resolveTarget(page: Page, target: Target): ResolveResult {
  let context: Page | FrameLocator | Locator = page;
  let strategy = '';

  // Frame handling
  if (target.frame) {
    if (target.frame === 'main') {
      context = page;
      strategy += 'frame:main → ';
    } else if (typeof target.frame === 'object') {
      if (target.frame.chain) {
        for (const frameName of target.frame.chain) {
          context = (context as Page | FrameLocator).frameLocator(`[name="${frameName}"], #${frameName}, iframe[title="${frameName}"]`);
        }
        strategy += `frame:chain[${target.frame.chain.join('→')}] → `;
      } else if (target.frame.name) {
        context = (context as Page | FrameLocator).frameLocator(`[name="${target.frame.name}"], #${target.frame.name}, iframe[title="${target.frame.name}"]`);
        strategy += `frame:${target.frame.name} → `;
      }
    }
  }

  // Scoping (within)
  if (target.within) {
    const container = resolveTarget(page, target.within);
    context = container.locator;
    strategy += `within(${container.strategy}) → `;
  }

  // Primary resolution
  let locator: Locator;

  if (target.role && target.name) {
    locator = getByRole(context, target.role, { name: target.name, exact: false });
    strategy += `role:${target.role}[name="${target.name}"]`;
  } else if (target.role && target.nameContains) {
    locator = getByRole(context, target.role, { name: new RegExp(escapeRegex(target.nameContains), 'i') });
    strategy += `role:${target.role}[nameContains="${target.nameContains}"]`;
  } else if (target.role) {
    locator = getByRole(context, target.role, {});
    strategy += `role:${target.role}`;
  } else if (target.label) {
    locator = (context as any).getByLabel(target.label);
    strategy += `label:"${target.label}"`;
  } else if (target.placeholder) {
    locator = (context as any).getByPlaceholder(target.placeholder);
    strategy += `placeholder:"${target.placeholder}"`;
  } else if (target.testId) {
    locator = (context as any).getByTestId(target.testId);
    strategy += `testId:"${target.testId}"`;
  } else if (target.css) {
    locator = (context as any).locator(target.css);
    strategy += `css:"${target.css}"`;
  } else if (target.text) {
    locator = (context as any).getByText(target.text);
    strategy += `text:"${target.text}"`;
  } else {
    throw new Error(`Target has no resolvable properties: ${JSON.stringify(target)}`);
  }

  // hasText filter (narrow down by text content)
  if (target.hasText) {
    locator = locator.filter({ hasText: target.hasText });
    strategy += `.filter(hasText:"${target.hasText}")`;
  }

  // nth disambiguation
  if (target.nth !== undefined && target.nth !== null) {
    locator = locator.nth(target.nth);
    strategy += `.nth(${target.nth})`;
  }

  return { locator, strategy };
}

/**
 * Resolve a target with fallback attempts.
 * Tries the primary target first, then each fallback in order.
 * Returns the first locator that finds a visible element.
 */
export async function resolveWithFallbacks(
  page: Page,
  target: Target,
  timeout: number = 3000,
): Promise<ResolveResult> {
  // Try primary
  try {
    const primary = resolveTarget(page, target);
    const visible = await primary.locator.isVisible({ timeout: Math.min(timeout, 2000) })
      .catch(() => false);
    if (visible) {
      return primary;
    }
    // Check if attached but not visible (might still be interactable)
    const count = await primary.locator.count().catch(() => 0);
    if (count > 0) {
      return primary;
    }
  } catch {
    // Primary resolution failed, try fallbacks
  }

  // Try fallbacks
  const fallbacks = target.fallbacks || [];
  for (let i = 0; i < fallbacks.length; i++) {
    try {
      const fallback = resolveTarget(page, fallbacks[i]);
      const visible = await fallback.locator.isVisible({ timeout: Math.min(timeout, 2000) })
        .catch(() => false);
      if (visible) {
        return {
          locator: fallback.locator,
          strategy: `fallback[${i}]: ${fallback.strategy}`,
        };
      }
      const count = await fallback.locator.count().catch(() => 0);
      if (count > 0) {
        return {
          locator: fallback.locator,
          strategy: `fallback[${i}]: ${fallback.strategy}`,
        };
      }
    } catch {
      continue;
    }
  }

  // Nothing found — return primary (will fail with Playwright's timeout on interaction)
  const primary = resolveTarget(page, target);
  return {
    locator: primary.locator,
    strategy: `primary (no match found): ${primary.strategy}`,
  };
}

/**
 * Helper to call getByRole on different context types (Page, FrameLocator, Locator).
 */
function getByRole(
  context: Page | FrameLocator | Locator,
  role: string,
  options: { name?: string | RegExp; exact?: boolean },
): Locator {
  // Playwright's getByRole accepts standard ARIA roles
  return (context as any).getByRole(role as any, options);
}

/**
 * Escape special regex characters in a string.
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
