/**
 * Appium Capability Profiles
 *
 * All values read from environment variables — never hardcoded.
 * Copy .env.example to .env and fill in your device/app details.
 *
 * Usage in wdio.conf.ts:
 *   import { getCapabilities } from './core/capabilities';
 */

export const androidCapabilities: WebdriverIO.Capabilities = {
  platformName: 'Android',
  'appium:automationName': 'UIAutomator2',

  // Device — use your real device serial (adb devices) or emulator name
  'appium:deviceName': process.env.ANDROID_DEVICE || 'emulator-5554',

  // App — one of: app path (install fresh) OR appPackage+appActivity (launch existing)
  ...(process.env.APP_PATH
    ? { 'appium:app': process.env.APP_PATH }
    : {
        'appium:appPackage': process.env.APP_PACKAGE,
        'appium:appActivity': process.env.APP_ACTIVITY,
      }),

  // Session behaviour
  'appium:noReset': process.env.NO_RESET === 'true',
  'appium:autoGrantPermissions': true,
  'appium:newCommandTimeout': 120,  // 120s idle timeout — real device UiAutomator2 commands can be slow

  // Performance — CRITICAL for React Native apps (Flipkart, Airbnb, etc.)
  'appium:skipDeviceInitialization': false,
  'appium:disableWindowAnimation': true,
};

export const iosCapabilities: WebdriverIO.Capabilities = {
  platformName: 'iOS',
  'appium:automationName': 'XCUITest',

  // Device — simulator name or real device UDID
  'appium:deviceName': process.env.IOS_DEVICE || 'iPhone 15',
  'appium:udid': process.env.IOS_UDID, // required for real devices

  // Platform version
  'appium:platformVersion': process.env.IOS_VERSION || '17.0',

  // App
  ...(process.env.IOS_APP_PATH
    ? { 'appium:app': process.env.IOS_APP_PATH }
    : { 'appium:bundleId': process.env.IOS_BUNDLE_ID }),

  // Session behaviour
  'appium:noReset': process.env.NO_RESET === 'true',
  'appium:autoAcceptAlerts': true,
  'appium:newCommandTimeout': 60,
};

/**
 * Returns capabilities for the current platform.
 * Platform is read from PLATFORM env var (android|ios). Defaults to android.
 */
export function getCapabilities(): WebdriverIO.Capabilities {
  const platform = (process.env.PLATFORM || 'android').toLowerCase();
  if (platform === 'ios') return iosCapabilities;
  return androidCapabilities;
}
