const { defineConfig, devices } = require('@playwright/test');
const dotenv = require('dotenv');

dotenv.config();

module.exports = defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [
    ['list'],
    ['json', { outputFile: 'test-results/results.json' }],
    ['html', { open: 'never' }],
  ],
  use: {
    baseURL: process.env.BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: parseInt(process.env.DEFAULT_TIMEOUT || '30000', 10),
    navigationTimeout: parseInt(process.env.NAVIGATION_TIMEOUT || '60000', 10),
    permissions: ['geolocation', 'notifications'],
    acceptDownloads: true,
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
            '--disable-features=PrivateNetworkAccessPermissionPrompt',
          ],
        },
      },
    },
  ],
});
