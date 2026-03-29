import { defineConfig } from '@playwright/test';
import * as dotenv from 'dotenv';

dotenv.config({ path: '../.env' });

export default defineConfig({
  testDir: '.',
  testMatch: 'scout.spec.ts',
  timeout: 1800000, // 30 min session
  use: {
    headless: false,
    viewport: { width: 1920, height: 1080 },
    actionTimeout: 10000,
    navigationTimeout: 30000,
  },
  projects: [
    {
      name: 'scout',
      use: {
        channel: 'chrome',
        launchOptions: {
          args: ['--disable-features=PrivateNetworkAccessPermissionPrompt'],
        },
      },
    },
  ],
});
