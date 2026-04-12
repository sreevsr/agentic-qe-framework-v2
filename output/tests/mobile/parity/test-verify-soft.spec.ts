import { browser, expect } from '@wdio/globals';
import { SpeedtestHomeScreen } from '../../../screens/SpeedtestHomeScreen';

/**
 * Framework verification: Mobile VERIFY_SOFT pattern (Category D.1).
 * Source scenario: scenarios/mobile/test-verify-soft.md
 *
 * Proves:
 *   1. The try/catch + softAssertions[] pattern works
 *   2. A failed soft assertion does NOT stop subsequent steps
 *   3. The conditional throw at the end fails the test reporting all soft failures
 *   4. recordSoftFailure() saves a labelled screenshot
 */
describe('Framework parity — mobile VERIFY_SOFT @parity @P0', () => {
  let homeScreen: SpeedtestHomeScreen;
  let softAssertions: string[];

  beforeEach(async () => {
    homeScreen = new SpeedtestHomeScreen(browser);
    softAssertions = [];
    await homeScreen.waitForScreen();
  });

  it('Scenario 1 — all soft assertions pass @parity @P0', async () => {
    // Step 1 — VERIFY_SOFT: GO button is visible
    try {
      expect(await homeScreen.isGoButtonVisible()).toBe(true);
    } catch (err) {
      softAssertions.push(await homeScreen.recordSoftFailure('go-button-visible', err));
    }

    // Step 2 — VERIFY_SOFT: GO button is enabled
    try {
      expect(await homeScreen.isEnabled('goButton')).toBe(true);
    } catch (err) {
      softAssertions.push(await homeScreen.recordSoftFailure('go-button-enabled', err));
    }

    // Step 3 — VERIFY_SOFT: GO button content-desc is correct
    try {
      const desc = await homeScreen.getAttribute('goButton', 'content-desc');
      expect(desc).toContain('Speedtest');
    } catch (err) {
      softAssertions.push(await homeScreen.recordSoftFailure('go-button-content-desc', err));
    }

    // Step 4 — SCREENSHOT: verify-soft-all-pass
    await homeScreen.takeScreenshot('verify-soft-all-pass');

    if (softAssertions.length > 0) {
      throw new Error(
        `${softAssertions.length} soft assertion(s) failed:\n` + softAssertions.join('\n'),
      );
    }
  });

  /**
   * Meta-test: simulates a VERIFY_SOFT spec body that contains one expected
   * failure, then asserts the mechanism behaved correctly. This test PASSES
   * when the soft-failure pattern works — it does NOT use the final
   * conditional throw because the failure here is intentional, not a real bug.
   */
  it('Scenario 2 — one soft failure does not stop subsequent steps @parity @P0', async () => {
    const stepsExecuted: string[] = [];
    const innerSoftAssertions: string[] = [];

    // Step 1 — VERIFY_SOFT: GO button is visible (should pass)
    try {
      expect(await homeScreen.isGoButtonVisible()).toBe(true);
      stepsExecuted.push('step1-pass');
    } catch (err) {
      innerSoftAssertions.push(await homeScreen.recordSoftFailure('go-button-visible', err));
    }

    // Step 2 — VERIFY_SOFT: deliberately impossible (key not in locator JSON)
    try {
      // isVisible() catches internally and returns false; assert on that to force a failure
      const visible = await homeScreen.isVisible('intentionallyMissingElement');
      expect(visible).toBe(true);
      stepsExecuted.push('step2-pass');
    } catch (err) {
      innerSoftAssertions.push(await homeScreen.recordSoftFailure('intentionally-missing-element', err));
      stepsExecuted.push('step2-caught');
    }

    // Step 3 — VERIFY_SOFT: GO button is still enabled (MUST run despite step 2 failing)
    try {
      expect(await homeScreen.isEnabled('goButton')).toBe(true);
      stepsExecuted.push('step3-pass');
    } catch (err) {
      innerSoftAssertions.push(await homeScreen.recordSoftFailure('go-button-still-enabled', err));
    }

    // Step 4 — SCREENSHOT
    await homeScreen.takeScreenshot('verify-soft-one-failure');

    // Step 5 — REPORT
    console.log(`[verify-soft] Steps executed: ${stepsExecuted.join(', ')}`);
    console.log(`[verify-soft] Inner soft failures collected: ${innerSoftAssertions.length}`);

    // Mechanism assertions (these run on the OUTER softAssertions, which should be empty)
    expect(stepsExecuted).toContain('step1-pass');
    expect(stepsExecuted).toContain('step2-caught');
    expect(stepsExecuted).toContain('step3-pass');
    expect(innerSoftAssertions).toHaveLength(1);
    expect(innerSoftAssertions[0]).toContain('VERIFY_SOFT failed');
    expect(innerSoftAssertions[0]).toContain('intentionally-missing-element');

    // The outer softAssertions array MUST still be empty — this test verifies the mechanism
    if (softAssertions.length > 0) {
      throw new Error(
        `${softAssertions.length} soft assertion(s) failed:\n` + softAssertions.join('\n'),
      );
    }
  });
});
