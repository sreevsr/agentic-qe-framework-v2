import { Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

/**
 * LocatorLoader — Loads selectors from JSON locator files.
 *
 * Supported prefixes: role=, label=, placeholder=, text=, testid=, xpath=
 * Default (no prefix): CSS selector
 */
export class LocatorLoader {
  private page: Page;
  private locators: Record<string, { primary: string; fallbacks?: string[] }>;

  constructor(page: Page, locatorFile: string) {
    this.page = page;
    const filePath = path.resolve(__dirname, '..', 'locators', locatorFile);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Locator file not found: ${filePath}`);
    }
    this.locators = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  }

  get(elementName: string): string {
    const entry = this.locators[elementName];
    if (!entry) {
      throw new Error(`Element '${elementName}' not found in locator file`);
    }
    return typeof entry === 'string' ? entry : entry.primary;
  }

  async getWithFallback(elementName: string): Promise<string> {
    const entry = this.locators[elementName];
    if (!entry) {
      throw new Error(`Element '${elementName}' not found in locator file`);
    }

    const primary = typeof entry === 'string' ? entry : entry.primary;
    const fallbacks = typeof entry === 'string' ? [] : (entry.fallbacks || []);

    const primaryCount = await this.page.locator(primary).count();
    if (primaryCount > 0) return primary;

    for (const fallback of fallbacks) {
      const count = await this.page.locator(fallback).count();
      if (count > 0) return fallback;
    }

    return primary;
  }

  getAll(elementName: string): string[] {
    const entry = this.locators[elementName];
    if (!entry) return [];
    if (typeof entry === 'string') return [entry];
    return [entry.primary, ...(entry.fallbacks || [])];
  }

  has(elementName: string): boolean {
    return elementName in this.locators;
  }
}
