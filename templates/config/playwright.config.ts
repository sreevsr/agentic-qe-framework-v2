import { defineConfig, devices } from '@playwright/test';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Per-environment .env loader. Set TEST_ENV=qa|stg|preprd|prd before running
// Playwright to load output/.env.{TEST_ENV}. Defaults to plain .env.
const testEnv = process.env.TEST_ENV;
dotenv.config({ path: path.join(__dirname, testEnv ? `.env.${testEnv}` : '.env') });

export default defineConfig({
  testDir: './tests',
  timeout: 180000,
  expect: {
    timeout: 30000,
  },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [
    ['list'],
    ['json', { outputFile: 'test-results/results.json' }],
    ['html', { open: 'never' }],
    ['allure-playwright', { outputFolder: 'allure-results' }],
  ],
  use: {
    baseURL: process.env.BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: parseInt(process.env.DEFAULT_TIMEOUT || '30000', 10),
    navigationTimeout: parseInt(process.env.NAVIGATION_TIMEOUT || '60000', 10),

    // Browser permissions — grant common permissions to prevent dialogs blocking tests
    permissions: ['geolocation', 'notifications'],

    // Accept file downloads without dialog
    acceptDownloads: true,

    // Bypass Content Security Policy (enable if app blocks Playwright injection)
    // bypassCSP: true,
  },
  projects: [
    {
      name: 'chrome',
      use: {
        ...devices['Desktop Chrome'],
        channel: 'chrome',
        headless: process.env.HEADLESS !== 'false',
        viewport: { width: 1920, height: 1080 },
        launchOptions: {
          args: [
            // Suppress Chrome's Private Network Access permission prompt
            '--disable-features=PrivateNetworkAccessPermissionPrompt',
            // Uncomment if CORS blocks test API calls from the browser:
            // '--disable-web-security',
          ],
        },
      },
    },
  ],
});
