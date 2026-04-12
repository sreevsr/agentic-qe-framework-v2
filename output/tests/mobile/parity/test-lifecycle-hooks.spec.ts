import { browser, expect } from '@wdio/globals';
import { SpeedtestHomeScreen } from '../../../screens/SpeedtestHomeScreen';

/**
 * Framework verification: Mobile lifecycle hook mapping (Category A).
 * Source scenario: scenarios/mobile/test-lifecycle-hooks.md
 *
 * Proves the four `Common Setup/Teardown [Once]` sections map to the
 * matching Mocha hooks (before / beforeEach / afterEach / after) and
 * that they fire in the expected order.
 */
describe('Framework parity — mobile lifecycle hooks @parity @P0', () => {
  let homeScreen: SpeedtestHomeScreen;
  const hookOrder: string[] = [];

  before(async () => {
    // [Setup Once] — runs once before all `it()` blocks
    hookOrder.push('before');
    console.log('[hook] before() fired — runs ONCE before all scenarios');
  });

  beforeEach(async () => {
    // [Before Each] — fresh state per scenario
    hookOrder.push('beforeEach');
    console.log('[hook] beforeEach() fired — runs before every scenario');
    homeScreen = new SpeedtestHomeScreen(browser);
    await homeScreen.waitForScreen();
  });

  afterEach(async () => {
    // [After Each] — capture evidence regardless of outcome
    hookOrder.push('afterEach');
    console.log('[hook] afterEach() fired — runs after every scenario');
    await homeScreen.takeScreenshot(`after-each-evidence-${Date.now()}`);
  });

  after(async () => {
    // [Teardown Once] — runs once after all `it()` blocks
    hookOrder.push('after');
    console.log('[hook] after() fired — runs ONCE after all scenarios');
    console.log(`[hook] Final order: ${hookOrder.join(' → ')}`);

    // Sanity check: expected order is
    //   before → beforeEach → afterEach → beforeEach → afterEach → after
    const expected = ['before', 'beforeEach', 'afterEach', 'beforeEach', 'afterEach', 'after'];
    if (JSON.stringify(hookOrder) !== JSON.stringify(expected)) {
      throw new Error(`Hook order mismatch.\n  Expected: ${expected.join(' → ')}\n  Actual:   ${hookOrder.join(' → ')}`);
    }
  });

  it('Scenario 1 — first test exercises the hooks @parity @P0', async () => {
    // Step 1 — VERIFY: app main screen is displayed
    expect(await homeScreen.isGoButtonVisible()).toBe(true);
    // Step 2 — SCREENSHOT: lifecycle-test-1
    await homeScreen.takeScreenshot('lifecycle-test-1');
  });

  it('Scenario 2 — second test confirms beforeEach/afterEach run between tests @parity @P0', async () => {
    // Step 1 — VERIFY: app main screen is displayed (proves beforeEach relaunched cleanly)
    expect(await homeScreen.isGoButtonVisible()).toBe(true);
    // Step 2 — SCREENSHOT: lifecycle-test-2
    await homeScreen.takeScreenshot('lifecycle-test-2');
  });
});
