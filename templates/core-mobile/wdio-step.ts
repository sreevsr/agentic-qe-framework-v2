/**
 * wdioStep — Mobile (WDIO + Allure) step wrapper for @steps-walkable helpers.
 *
 * Wraps an action with allureReporter.startStep / endStep so that when an
 * `@steps`-walkable helper in output/screens/*.helpers.ts is invoked from a
 * spec, each of the helper's internal steps appears as a nested step under
 * the calling spec's `it()` row in the Allure report. The wrapper auto-marks
 * `passed` on success, `failed` on throw, and re-throws so the test still
 * fails.
 *
 * Mobile-only: this file imports `@wdio/allure-reporter` and is only valid
 * inside the WDIO runner. DO NOT use in Playwright web specs/helpers — web
 * uses `test.step` from `@playwright/test` instead.
 *
 * Usage (inside an @steps-walkable helper):
 *
 *   import { wdioStep } from '../core/wdio-step';
 *
 *   await wdioStep('Tap the Save button', async () => {
 *     await this.tapSave();
 *   });
 *
 *   const userId = await wdioStep('CAPTURE: user id from confirmation', async () => {
 *     return await this.getUserId();
 *   });
 */
import allureReporter from '@wdio/allure-reporter';

export async function wdioStep<T>(name: string, body: () => Promise<T>): Promise<T> {
  allureReporter.startStep(name);
  try {
    const result = await body();
    allureReporter.endStep('passed');
    return result;
  } catch (err) {
    allureReporter.endStep('failed');
    throw err;
  }
}
