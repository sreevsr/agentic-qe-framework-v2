import { browser, expect } from '@wdio/globals';
import { SpeedtestHomeScreen } from '../../../screens/SpeedtestHomeScreen';
import { loadTestData } from '../../../core/test-data-loader';
import { saveState, loadState, clearState } from '../../../core/shared-state';

/**
 * Framework verification: Mobile SHARED_DATA + SAVE/loadState (Categories D.3 + D.4).
 * Source scenario: scenarios/mobile/test-shared-data.md
 *
 * Proves:
 *   1. loadTestData() works in a mobile spec (no Playwright dependency)
 *   2. SHARED_DATA merges shared/mobile-users.json into testData
 *   3. saveState() writes to shared-state.json
 *   4. A second scenario can read the saved value via loadState()
 */
describe('Framework parity — mobile SHARED_DATA + saveState @parity @P2 @android-only', () => {
  // SHARED_DATA: mobile-users
  const testData = loadTestData('mobile/test-shared-data', ['mobile-users']);
  const STATE_KEY = 'lastMobileRunTimestamp';

  before(async () => {
    // Clean any leftover state from a previous run
    clearState(STATE_KEY);
  });

  it('Scenario 1 — load shared data and save a value @parity @P2', async () => {
    const homeScreen = new SpeedtestHomeScreen(browser);

    // Step 1 — VERIFY: SHARED_DATA merge worked
    expect(testData.mobileTestUser).toBeDefined();
    expect(testData.mobileTestUser.username).toBe('test-user@example.com');
    expect(testData.scenarioMetadata).toBeDefined();
    expect(testData.scenarioMetadata.name).toBe('framework-parity-shared-data');
    console.log(`[shared-data] Loaded user: ${testData.mobileTestUser.displayName}`);

    // Step 2 — Wait for app
    await homeScreen.waitForScreen();

    // Step 3 — CAPTURE: device timestamp
    const savedTimestamp = String(Date.now());
    console.log(`[shared-data] Captured timestamp: ${savedTimestamp}`);

    // Step 4 — SAVE
    saveState(STATE_KEY, savedTimestamp);
    console.log(`[shared-data] Saved to shared-state.json key="${STATE_KEY}"`);

    // Verify the round-trip works in the same process
    const roundTrip = loadState(STATE_KEY);
    expect(roundTrip).toBe(savedTimestamp);
  });

  it('Scenario 2 — load the value saved in scenario 1 @parity @P2', async () => {
    const homeScreen = new SpeedtestHomeScreen(browser);

    // Step 1 — Wait for app
    await homeScreen.waitForScreen();

    // Step 2 — CAPTURE via loadState
    const loadedTimestamp = loadState(STATE_KEY);
    console.log(`[shared-data] Loaded timestamp from previous scenario: ${loadedTimestamp}`);

    // Step 3 — VERIFY: not empty AND parses as a recent timestamp
    expect(loadedTimestamp).toBeDefined();
    expect(loadedTimestamp).not.toBe('');
    const parsed = parseInt(loadedTimestamp, 10);
    expect(Number.isFinite(parsed)).toBe(true);
    expect(Date.now() - parsed).toBeLessThan(60_000); // Saved < 60s ago

    // Step 4 — REPORT
    console.log(`[shared-data] Cross-scenario state transfer verified`);
  });

  after(async () => {
    clearState(STATE_KEY);
  });
});
