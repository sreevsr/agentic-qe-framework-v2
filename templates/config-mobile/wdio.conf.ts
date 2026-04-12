import * as dotenv from 'dotenv';
import * as path from 'path';
import { getCapabilities } from './core/capabilities';

// Load environment variables
const env = process.env.TEST_ENV || 'dev';
dotenv.config({ path: path.join(__dirname, `.env.${env}`) });
dotenv.config({ path: path.join(__dirname, '.env') });

export const config = {
  //
  // ─── Runner ───────────────────────────────────────────────────────────────
  //
  runner: 'local',

  //
  // ─── Specs ────────────────────────────────────────────────────────────────
  //
  // Run ONLY the specified scenario's spec — never all specs.
  // Usage: npx wdio run wdio.conf.ts --spec tests/mobile/{folder}/{scenario}.spec.ts
  //
  specs: ['./tests/mobile/**/*.spec.ts'],
  exclude: [],

  //
  // ─── Capabilities ─────────────────────────────────────────────────────────
  //
  maxInstances: 1,
  capabilities: [getCapabilities()],

  //
  // ─── Appium ───────────────────────────────────────────────────────────────
  //
  hostname: process.env.APPIUM_HOST || 'localhost',
  port: parseInt(process.env.APPIUM_PORT || '4723', 10),
  path: '/',
  connectionRetryTimeout: 60000,
  connectionRetryCount: 3,

  //
  // ─── Framework ────────────────────────────────────────────────────────────
  //
  framework: 'mocha',
  mochaOpts: {
    ui: 'bdd',
    timeout: 600000,       // 600s per test — complex 43-step Flipkart checkout flow on real device needs more time
    retries: 0,
  },

  //
  // ─── Reporters ────────────────────────────────────────────────────────────
  //
  reporters: [
    'spec',
    ['json', {
      outputDir: './test-results',
      outputFileFormat: () => 'mobile-results.json',
    }],
    ['allure', {
      outputDir: './allure-results',
      disableWebdriverStepsReporting: false,
      disableWebdriverScreenshotsReporting: false,
    }],
  ],

  //
  // ─── Timeouts ─────────────────────────────────────────────────────────────
  //
  waitforTimeout: 15000,
  waitforInterval: 500,

  //
  // ─── Hooks ────────────────────────────────────────────────────────────────
  //
  onPrepare() {
    console.log(`\nPlatform: ${process.env.PLATFORM || 'android'}`);
    console.log(`Device: ${process.env.ANDROID_DEVICE || process.env.IOS_DEVICE || 'default'}`);
    console.log(`Appium: ${process.env.APPIUM_HOST || 'localhost'}:${process.env.APPIUM_PORT || '4723'}\n`);
  },

  /**
   * CRITICAL for React Native apps (Flipkart, Airbnb, etc.):
   * Apply UiAutomator2 settings to skip slow "wait for idle" behavior.
   *
   * Without these, every element lookup waits 10s for "app idle" before querying,
   * then does a full accessibility tree traversal. On RN apps with never-idle UIs
   * (rotating banners, live updates), queries can take 30s+ each.
   *
   * With these settings, queries run immediately and traverse only interactive views.
   */
  async before() {
    try {
      await (browser as any).updateSettings({
        waitForIdleTimeout: 0,
        waitForSelectorTimeout: 5000,
        actionAcknowledgmentTimeout: 500,
        keyInjectionDelay: 0,
        ignoreUnimportantViews: true,
        allowInvisibleElements: false,
      });
      console.log('[wdio.conf] UiAutomator2 settings applied (fast mode for RN apps)');
    } catch (err) {
      console.log('[wdio.conf] Could not apply UiAutomator2 settings:', (err as Error).message);
    }
  },

  /**
   * Reset the app to its launch state before every spec file (Mocha suite).
   *
   * WHY: With NO_RESET=true (required for fast real-device runs to avoid
   * the multi-second app reinstall), Appium does NOT relaunch the app at
   * session start — it just attaches to whatever the device is currently
   * showing. If the previous spec, a previous test run, or even normal
   * device usage left the device on a different screen, the next spec's
   * `waitForScreen()` will time out.
   *
   * HOW: terminateApp + activateApp on the configured APP_PACKAGE makes the
   * app foreground from a known launch state. ~1s per spec on a real device,
   * vs ~15s for a full session restart with NO_RESET=false.
   *
   * Skipped when APP_PACKAGE is not set (web/api/hybrid suites).
   */
  async beforeSuite(_suite: any) {
    const appPackage = process.env.APP_PACKAGE;
    if (!appPackage) return;
    try {
      await (browser as any).terminateApp(appPackage);
    } catch { /* app may not be running yet */ }
    try {
      await (browser as any).activateApp(appPackage);
    } catch (err) {
      console.error(`[beforeSuite] Could not activate ${appPackage}:`, (err as Error).message);
    }
  },

  /**
   * Start screen recording before each test. Recording is kept only if the
   * test fails (see afterTest); successful test recordings are discarded.
   */
  async beforeTest(_test: any) {
    try {
      await (browser as any).startRecordingScreen({
        timeLimit: 300,
        videoSize: '720x1280',
        bitRate: 2000000,
      });
    } catch { /* recording not supported on this device/driver */ }
  },

  /**
   * On test failure capture: screenshot + page source + screen recording.
   * Successful test recordings are stopped and discarded so the disk does
   * not fill up.
   */
  async afterTest(test: any, _context: any, { error }: { error: any }) {
    const safeName = (test.title || 'unknown').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
    const timestamp = Date.now();

    let base64Video: string | undefined;
    try {
      base64Video = await (browser as any).stopRecordingScreen();
    } catch { /* not running */ }

    if (!error) return;

    console.error(`FAILED: ${test.title}`);
    const fs = await import('fs');
    const pathMod = await import('path');

    try {
      const file = `test-results/screenshots/FAILED-${safeName}-${timestamp}.png`;
      fs.mkdirSync(pathMod.dirname(file), { recursive: true });
      await (browser as any).saveScreenshot(file);
      console.error(`[afterTest] Failure screenshot: ${file}`);
    } catch (e) {
      console.error(`[afterTest] Could not save screenshot: ${(e as Error).message}`);
    }

    try {
      const file = `test-results/page-sources/FAILED-${safeName}-${timestamp}.xml`;
      fs.mkdirSync(pathMod.dirname(file), { recursive: true });
      const source = await browser.getPageSource();
      fs.writeFileSync(file, source);
      console.error(`[afterTest] Failure page source: ${file}`);
    } catch (e) {
      console.error(`[afterTest] Could not save page source: ${(e as Error).message}`);
    }

    if (base64Video) {
      try {
        const file = `test-results/videos/FAILED-${safeName}-${timestamp}.mp4`;
        fs.mkdirSync(pathMod.dirname(file), { recursive: true });
        fs.writeFileSync(file, Buffer.from(base64Video, 'base64'));
        console.error(`[afterTest] Failure video: ${file}`);
      } catch (e) {
        console.error(`[afterTest] Could not save video: ${(e as Error).message}`);
      }
    }
  },
};
