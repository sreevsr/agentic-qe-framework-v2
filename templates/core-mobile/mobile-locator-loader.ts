import * as fs from 'fs';
import * as path from 'path';

/**
 * Supported Appium locator strategies.
 * Priority: accessibility_id > id > xpath > uiautomator (Android) > class_chain (iOS) > predicate_string (iOS)
 */
export type MobileStrategy =
  | 'accessibility_id'
  | 'id'
  | 'xpath'
  | 'uiautomator'
  | 'class_chain'
  | 'predicate_string';

export interface PlatformStrategies {
  accessibility_id?: string;
  id?: string;
  xpath?: string;
  uiautomator?: string;
  class_chain?: string;
  predicate_string?: string;
}

export interface MobileLocatorEntry {
  android?: PlatformStrategies;
  ios?: PlatformStrategies;
  description?: string;
  type?: string;
}

export type MobileLocatorMap = Record<string, MobileLocatorEntry>;

/** Priority order for strategy resolution — Android */
const ANDROID_STRATEGY_PRIORITY: MobileStrategy[] = [
  'accessibility_id',
  'id',
  'uiautomator',
  'xpath',
];

/** Priority order for strategy resolution — iOS */
const IOS_STRATEGY_PRIORITY: MobileStrategy[] = [
  'accessibility_id',
  'id',
  'class_chain',
  'predicate_string',
  'xpath',
];

/**
 * Converts a strategy + value pair to a WebdriverIO selector string.
 */
export function buildMobileSelector(strategy: MobileStrategy, value: string): string {
  switch (strategy) {
    case 'accessibility_id':
      return `~${value}`;
    case 'id':
      return value.includes(':id/') ? `id=${value}` : `~${value}`;
    case 'xpath':
      return value;
    case 'uiautomator':
      return `android=${value}`;
    case 'class_chain':
      return `-ios class chain:${value}`;
    case 'predicate_string':
      return `-ios predicate string:${value}`;
    default:
      return value;
  }
}

/**
 * MobileLocatorLoader — resolves named elements from a locator JSON file
 * for a given screen, trying strategies in priority order for the active platform.
 *
 * Locator JSON files live at: output/locators/mobile/{screenName}.locators.json
 *
 * Each element entry is platform-keyed:
 * {
 *   "goButton": {
 *     "android": { "accessibility_id": "Start a Speedtest", "id": "..." },
 *     "ios": { "accessibility_id": "Start a Speedtest", "class_chain": "..." },
 *     "description": "GO button",
 *     "type": "button"
 *   }
 * }
 *
 * The loader reads PLATFORM from env and uses the correct strategy priority.
 */
export class MobileLocatorLoader {
  private locators: MobileLocatorMap;
  private platform: 'android' | 'ios';
  private strategyPriority: MobileStrategy[];

  constructor(
    private driver: WebdriverIO.Browser,
    private screenName: string,
    private locatorsBasePath = path.join(process.cwd(), 'locators', 'mobile'),
  ) {
    this.platform = ((process.env.PLATFORM || 'android').toLowerCase()) as 'android' | 'ios';
    this.strategyPriority = this.platform === 'ios' ? IOS_STRATEGY_PRIORITY : ANDROID_STRATEGY_PRIORITY;
    this.locators = this.loadLocators();
  }

  private loadLocators(): MobileLocatorMap {
    const filePath = path.join(this.locatorsBasePath, `${this.screenName}.locators.json`);
    if (!fs.existsSync(filePath)) {
      throw new Error(
        `Locator file not found: ${filePath}\n` +
        `Expected at: locators/mobile/${this.screenName}.locators.json`,
      );
    }
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as MobileLocatorMap;
  }

  /**
   * Resolves an element by key, trying strategies in priority order for the active platform.
   * Returns the first WebdriverIO element that exists in the current UI.
   *
   * @throws if the element key is unknown or no strategy resolves to an existing element
   */
  async get(elementKey: string) {
    const entry = this.locators[elementKey];
    if (!entry) {
      throw new Error(
        `Unknown element key "${elementKey}" on screen "${this.screenName}".\n` +
        `Available keys: ${Object.keys(this.locators).join(', ')}`,
      );
    }

    const platformEntry = entry[this.platform];
    if (!platformEntry) {
      throw new Error(
        `Element "${elementKey}" on screen "${this.screenName}" has no selectors for platform "${this.platform}".\n` +
        `Available platforms: ${Object.keys(entry).filter(k => k === 'android' || k === 'ios').join(', ')}`,
      );
    }

    const errors: string[] = [];

    for (const strategy of this.strategyPriority) {
      const value = platformEntry[strategy];
      if (!value) continue;

      try {
        const selector = buildMobileSelector(strategy, value);
        const el = await this.driver.$(selector);
        if (await el.isExisting()) {
          return el;
        }
        errors.push(`${strategy}="${value}" → element not found in UI`);
      } catch (err) {
        errors.push(`${strategy}="${value}" → ${(err as Error).message}`);
      }
    }

    throw new Error(
      `Element "${elementKey}" on screen "${this.screenName}" (platform: ${this.platform}) could not be resolved.\n` +
      `Tried:\n${errors.map((e) => `  - ${e}`).join('\n')}`,
    );
  }

  /**
   * Returns all known element keys for this screen.
   */
  getKeys(): string[] {
    return Object.keys(this.locators);
  }

  /** Returns true if the given key exists in the locator file. */
  has(elementKey: string): boolean {
    return elementKey in this.locators;
  }

  /** Returns the raw locator entry (platform-keyed). Throws on unknown key. */
  getEntry(elementKey: string): MobileLocatorEntry {
    const entry = this.locators[elementKey];
    if (!entry) {
      throw new Error(`Element "${elementKey}" not found on screen "${this.screenName}"`);
    }
    return entry;
  }

  /**
   * Returns all platform-resolved selectors for an element key (for the
   * given platform). Useful for debugging or driver.$$() bulk queries.
   */
  getAllSelectors(elementKey: string, platform: 'android' | 'ios' = this.platform): string[] {
    const entry = this.getEntry(elementKey);
    const platformEntry = entry[platform];
    if (!platformEntry) return [];
    return (Object.keys(platformEntry) as MobileStrategy[])
      .filter((k) => !k.startsWith('_') && platformEntry[k])
      .map((strategy) => buildMobileSelector(strategy, platformEntry[strategy] as string));
  }

  /** Active platform key ('android' or 'ios') resolved at construction. */
  getPlatform(): 'android' | 'ios' {
    return this.platform;
  }
}
