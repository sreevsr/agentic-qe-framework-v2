import { defineConfig } from '@playwright/test';
import * as dotenv from 'dotenv';

// Load .env from output/ directory (CWD when running from output/)
dotenv.config();

export default defineConfig({
  testDir: '.',
  testMatch: 'scout.spec.ts',
  timeout: 1800000, // 30 min session
  use: {
    headless: false,
    viewport: null,  // Use full browser window size, not a fixed viewport
    actionTimeout: 10000,
    navigationTimeout: 30000,
    bypassCSP: true,
  },
  projects: [
    {
      name: 'scout',
      use: {
        channel: 'chrome',
        launchOptions: {
          args: [
            '--start-maximized',
            '--disable-features=PrivateNetworkAccessPermissionPrompt',
          ],
        },
      },
    },
  ],
});
