import * as dotenv from 'dotenv';
import * as path from 'path';

/**
 * BrowserStack App Automate — trial run config.
 *
 * Separate from the local wdio.conf.ts so you can run against BrowserStack
 * without touching your local Appium setup:
 *
 *   npx wdio run wdio.browserstack.conf.ts
 *
 * Auth: set BROWSERSTACK_USERNAME and BROWSERSTACK_ACCESS_KEY env vars
 * before running. Never commit them.
 *
 * Apps: two BrowserStack published sample apps, uploaded once to your
 * account's App Automate storage. URLs below are the bs:// references.
 */

const env = process.env.TEST_ENV || 'dev';
dotenv.config({ path: path.join(__dirname, `.env.${env}`) });
dotenv.config({ path: path.join(__dirname, '.env') });

// Uploaded app references — scoped to YOUR BrowserStack account.
//
// After uploading your app via the curl commands in
// docs/onboarding/cloud-farms.md § 3, BrowserStack returns a `bs://...` URL
// in the upload response. Paste those URLs below, OR set the env vars
// BROWSERSTACK_ANDROID_APP_URL / BROWSERSTACK_IOS_APP_URL to keep the URLs
// out of tracked config files (recommended for shared repos).
//
// The placeholder strings below intentionally fail loudly if the env vars
// aren't set — you'll get "App not found" from BrowserStack instead of a
// silent run with an empty `appium:app`.
const ANDROID_APP_URL =
  process.env.BROWSERSTACK_ANDROID_APP_URL
  || 'bs://REPLACE-WITH-YOUR-ANDROID-APP-ID';

const IOS_APP_URL =
  process.env.BROWSERSTACK_IOS_APP_URL
  || 'bs://REPLACE-WITH-YOUR-IOS-APP-ID';

const BUILD_NAME = `trial-${new Date().toISOString().slice(0, 10)}`;

export const config = {
  runner: 'local',

  // Narrow glob — only pick up the trial spec, not the Flipkart/parity specs.
  specs: ['./tests/mobile/browserstack-trial/**/*.spec.ts'],
  exclude: [],

  // BrowserStack free trial allows 1 parallel session. Setting to 1
  // forces the two capabilities to run sequentially — Android first,
  // then iOS. Total wall-clock time: ~2-3 minutes.
  maxInstances: 1,

  // Auth — read from env vars, NEVER hardcoded.
  user: process.env.BROWSERSTACK_USERNAME,
  key: process.env.BROWSERSTACK_ACCESS_KEY,

  services: [
    ['browserstack', {
      browserstackLocal: false,   // true only if testing an app that talks to localhost services
    }],
  ],

  // Capability filter: set PLATFORM=ios or PLATFORM=android in the env to run
  // only one device. Unset (or PLATFORM=both) runs both sequentially. This lets
  // the same config cover cross-platform smoke AND single-platform scenario runs
  // without maintaining two config files.
  capabilities: (() => {
    const platformFilter = (process.env.PLATFORM || 'both').toLowerCase();
    const androidCap = {
      platformName: 'Android',
      'appium:app': ANDROID_APP_URL,
      'bstack:options': {
        deviceName: 'Samsung Galaxy S22',
        osVersion: '12.0',
        projectName: 'agentic-qe-framework',
        buildName: BUILD_NAME,
        sessionName: 'browserstack-android',
        appiumVersion: '2.0.1',
      },
    };
    const iosCap = {
      platformName: 'iOS',
      'appium:app': IOS_APP_URL,
      'appium:automationName': 'XCUITest',
      'bstack:options': {
        deviceName: 'iPhone 14',
        osVersion: '16',
        projectName: 'agentic-qe-framework',
        buildName: BUILD_NAME,
        sessionName: 'browserstack-ios',
        appiumVersion: '2.0.1',
      },
    };
    if (platformFilter === 'ios') return [iosCap];
    if (platformFilter === 'android') return [androidCap];
    return [androidCap, iosCap];
  })(),

  framework: 'mocha',
  mochaOpts: {
    ui: 'bdd',
    timeout: 300000,   // 5 min per test — BrowserStack session provisioning adds ~30-60s
  },

  reporters: [
    'spec',
    ['json', {
      outputDir: './test-results',
      outputFileFormat: () => 'browserstack-trial-results.json',
    }],
  ],

  waitforTimeout: 15000,
  waitforInterval: 500,
  logLevel: 'info',
};
