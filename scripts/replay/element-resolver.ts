/**
 * element-resolver.ts — Translates plan target objects into Playwright Locator instances.
 *
 * Resolution priority (text-first — safer for custom components):
 *   1. text                → page.getByText(text) — works on ANY element with visible text
 *   2. role + name         → page.getByRole(role, { name }) — only reliable for standard HTML
 *   3. role + nameContains → page.getByRole(role, { name: /pattern/i })
 *   4. label               → page.getByLabel(label)
 *   5. placeholder         → page.getByPlaceholder(placeholder)
 *   6. testId              → page.getByTestId(testId)
 *   7. css                 → page.locator(css)
 *   8. fallbacks[n]        → try each in order
 *
 * Scoping:
 *   - within → narrows to a container locator
 *   - frame  → switches to iframe context
 *   - nth    → disambiguates multiple matches
 */

import { Page, Locator, FrameLocator } from 'playwright';
import { ElementFingerprint } from './page-scanner';
import { resolveByFingerprint } from './fingerprint-resolver';

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
  /** Multi-signal fingerprint from page-scanner (enables self-healing). */
  _fingerprint?: ElementFingerprint;
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

  // Primary resolution — text-first for reliability with custom components
  // (MCP accessibility tree infers roles that may not match actual DOM)
  let locator: Locator;

  if (target.text) {
    // Text matching works on ANY element — most reliable for custom components
    locator = (context as any).getByText(target.text);
    strategy += `text:"${target.text}"`;
  } else if (target.role && target.name) {
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
 *
 * Resolution order:
 *   1. Fingerprint (if _fingerprint present) — multi-signal self-healing
 *   2. Primary target (role/text/label/css)
 *   3. Explicit fallbacks[]
 *   4. Last resort: return primary locator (will timeout on interaction)
 */
export async function resolveWithFallbacks(
  page: Page,
  target: Target,
  timeout: number = 3000,
): Promise<ResolveResult> {
  // --- Fingerprint resolution (Tier 1 + Tier 2 self-healing) ---
  if (target._fingerprint) {
    try {
      const match = await resolveByFingerprint(page, target._fingerprint, timeout);
      if (match) {
        return {
          locator: match.locator,
          strategy: match.healed
            ? `🔧 ${match.strategy}`
            : match.strategy,
        };
      }
    } catch {
      // Fingerprint resolution failed, fall through to legacy resolution
    }
  }

  // --- Legacy resolution (existing behavior for plans without fingerprints) ---

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
