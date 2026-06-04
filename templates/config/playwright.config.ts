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

    // Browser permissions — grant common permissions to prevent dialogs blocking tests.
    // 'local-network-access' suppresses Chrome's "Allow local network access?" prompt on
    // apps that fetch from private-network ranges (enterprise apps behind VPNs commonly do).
    permissions: ['local-network-access', 'geolocation', 'notifications'],

    // Accept file downloads without dialog
    acceptDownloads: true,

    // Bypass Content Security Policy (enable if app blocks Playwright injection)
    // bypassCSP: true,
  },
  projects: [
    {
      name: 'chrome',
      testDir: './tests',
      use: {
        ...devices['Desktop Chrome'],
        channel: 'chrome',
        headless: process.env.HEADLESS !== 'false',
        viewport: { width: 1280, height: 1024 },
        launchOptions: {
          args: [
            // Suppress Chrome's Private Network Access permission prompt
            '--disable-features=PrivateNetworkAccessPermissionPrompt',
            // Uncomment if the app still hits PNA preflight blocks after the permission
            // prompt is suppressed (rare — affects apps whose backend sits on a private
            // network range and uses CORS with preflight). More aggressive than the
            // prompt suppression above; disables the preflight mechanism itself.
            // '--disable-features=PrivateNetworkAccessSendPreflights',
            // Uncomment if CORS blocks test API calls from the browser:
            // '--disable-web-security',
          ],
        },
      },
    },
    {
      // Unit tests for framework-level utilities under output/utils/.
      // Kept out of the default `chrome` project so regression runs (npm test) don't pick them up.
      // Invoke with: `npm run test:unit` or `npx playwright test --project=unit`.
      // Some collector tests use the `page` fixture with inline data: URLs — no app navigation,
      // no .env required.
      name: 'unit',
      testDir: './utils',
      testMatch: '**/*.test.ts',
      timeout: 30000,
      use: {
        ...devices['Desktop Chrome'],
        headless: true,
        // No baseURL, trace, video — these are fast pure/inline-HTML tests.
      },
    },
  ],
});
