import { Page, Locator } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

/**
 * LocatorLoader — Loads selectors from JSON locator files.
 *
 * Supports semantic selector prefixes that are resolved to Playwright-compatible format:
 * - role=button[name='Submit']  → page.getByRole('button', { name: 'Submit' })
 * - label=Email                 → page.getByLabel('Email')
 * - placeholder=Enter email     → page.getByPlaceholder('Enter email')
 * - text=Welcome                → page.getByText('Welcome')
 * - testid=submit-btn           → page.getByTestId('submit-btn')
 * - xpath=//div[@id='main']     → page.locator('xpath=//div[@id="main"]')
 * - (no prefix)                 → CSS selector (default)
 */
export class LocatorLoader {
  private page: Page;
  private locators: Record<string, string | { primary: string; fallbacks?: string[] }>;

  constructor(page: Page, locatorFile: string) {
    this.page = page;
    const filePath = path.resolve(__dirname, '..', 'locators', locatorFile);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Locator file not found: ${filePath}`);
    }
    this.locators = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  }

  /**
   * Get the primary selector string for a named element.
   * Resolves semantic prefixes (testid=, role=, label=, etc.) to CSS equivalents
   * so the result can be used with page.locator().
   */
  get(elementName: string): string {
    const entry = this.locators[elementName];
    if (!entry) {
      throw new Error(`Element '${elementName}' not found in locator file`);
    }
    const raw = typeof entry === 'string' ? entry : entry.primary;
    return this.resolveToCSS(raw);
  }

  /**
   * Get a Playwright Locator using the appropriate Playwright method
   * based on the selector prefix (getByRole, getByLabel, getByTestId, etc.).
   */
  getLocator(elementName: string): Locator {
    const entry = this.locators[elementName];
    if (!entry) {
      throw new Error(`Element '${elementName}' not found in locator file`);
    }
    const raw = typeof entry === 'string' ? entry : entry.primary;
    return this.resolve(raw);
  }

  /**
   * Try primary selector, then fallbacks in order.
   * Returns the first selector string that finds an element on the page.
   * Uses a short timeout (2s) per selector to avoid blocking on missing elements.
   */
  async getWithFallback(elementName: string): Promise<string> {
    const entry = this.locators[elementName];
    if (!entry) {
      throw new Error(`Element '${elementName}' not found in locator file`);
    }

    const primary = typeof entry === 'string' ? entry : entry.primary;
    const fallbacks = typeof entry === 'string' ? [] : (entry.fallbacks || []);
    const allSelectors = [primary, ...fallbacks];

    for (const selector of allSelectors) {
      try {
        const locator = this.resolve(selector);
        // Use waitFor with short timeout instead of immediate count()
        // This handles dynamically rendered elements that appear after a brief delay
        await locator.waitFor({ state: 'attached', timeout: 2000 });
        return this.resolveToCSS(selector);
      } catch {
        continue;
      }
    }

    // All failed — return primary (let Playwright's auto-wait handle it)
    return this.resolveToCSS(primary);
  }

  /**
   * Get all selectors (primary + fallbacks) for a named element.
   */
  getAll(elementName: string): string[] {
    const entry = this.locators[elementName];
    if (!entry) return [];
    if (typeof entry === 'string') return [entry];
    return [entry.primary, ...(entry.fallbacks || [])];
  }

  /**
   * Check if an element name exists in the locator file.
   */
  has(elementName: string): boolean {
    return elementName in this.locators;
  }

  /**
   * Resolve a selector string to a Playwright Locator using the appropriate method.
   */
  private resolve(selector: string): Locator {
    // Role-based: "role=button[name='Submit']"
    if (selector.startsWith('role=')) {
      const match = selector.match(/^role=(\w+)(?:\[name='(.+)'\])?$/);
      if (match) {
        return match[2]
          ? this.page.getByRole(match[1] as any, { name: match[2] })
          : this.page.getByRole(match[1] as any);
      }
    }

    // Label-based: "label=Email"
    if (selector.startsWith('label=')) {
      return this.page.getByLabel(selector.slice(6));
    }

    // Placeholder-based: "placeholder=Enter email"
    if (selector.startsWith('placeholder=')) {
      return this.page.getByPlaceholder(selector.slice(12));
    }

    // Text-based: "text=Welcome"
    if (selector.startsWith('text=')) {
      return this.page.getByText(selector.slice(5));
    }

    // TestId-based: "testid=submit-btn"
    if (selector.startsWith('testid=')) {
      return this.page.getByTestId(selector.slice(7));
    }

    // Default: CSS or XPath (Playwright handles both)
    return this.page.locator(selector);
  }

  /**
   * Convert a semantic prefix selector to a CSS-compatible string
   * for use with page.locator(). This is the sync path used by get().
   */
  private resolveToCSS(selector: string): string {
    if (selector.startsWith('testid=')) {
      return `[data-testid='${selector.slice(7)}']`;
    }
    if (selector.startsWith('role=')) {
      // role= can't be cleanly converted to CSS — return as-is for page.locator()
      // Playwright's locator() supports role= prefix natively
      return selector;
    }
    if (selector.startsWith('text=')) {
      // Playwright locator() supports text= prefix natively
      return selector;
    }
    if (selector.startsWith('label=') || selector.startsWith('placeholder=')) {
      // These need the Locator API — return as-is, page.locator() may not handle them
      // For these, prefer using getLocator() instead of get()
      return selector;
    }
    // CSS, XPath, or other — pass through
    return selector;
  }
}
