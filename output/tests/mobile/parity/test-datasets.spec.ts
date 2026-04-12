import { browser, expect } from '@wdio/globals';
import { SpeedtestHomeScreen } from '../../../screens/SpeedtestHomeScreen';
import testData from '../../../test-data/mobile/test-datasets-datasets.json';

/**
 * Framework verification: Mobile DATASETS pattern (Category D.2).
 * Source scenario: scenarios/mobile/test-datasets.md
 *
 * The for...of loop is INSIDE describe() and OUTSIDE any it() so Mocha
 * discovers each row as a separate test at file load time.
 */
describe('Framework parity — mobile DATASETS @parity @P2', () => {
  for (const data of testData) {
    it(`Row ${data.caseId} (${data.label}) — launch verification @parity @P2`, async () => {
      const homeScreen = new SpeedtestHomeScreen(browser);

      // Step 1 — wait for app
      await homeScreen.waitForScreen();
      // Step 2 — VERIFY: GO button visible
      expect(await homeScreen.isGoButtonVisible()).toBe(data.expectedVisible);
      // Step 3 — CAPTURE: current Activity
      const currentActivity = await (browser as any).getCurrentActivity();
      // Step 4 — REPORT
      console.log(`[datasets] Row ${data.caseId} (${data.label}) — activity ${currentActivity}`);
      // Step 5 — SCREENSHOT
      await homeScreen.takeScreenshot(`dataset-${data.caseId}`);
    });
  }
});
