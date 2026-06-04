/**
 * wdio-types.d.ts — Global type augmentation for WebdriverIO.Browser
 *
 * Why this file exists
 * ────────────────────
 * WebdriverIO's official types in `@wdio/globals` and `@wdio/types` do not
 * expose the Appium-specific mobile commands that mobile specs need at
 * teardown / lifecycle boundaries — most notably:
 *
 *   - browser.terminateApp(bundleId)
 *   - browser.activateApp(bundleId)
 *   - browser.queryAppState(bundleId)
 *   - browser.hideKeyboard()
 *
 * Without these declarations, specs that call them either:
 *   - Use `(browser as any).terminateApp(...)` — silences TypeScript on
 *     critical teardown code paths; risky if signatures ever change
 *   - Generate a tsc error and fail the Builder's pre-flight TypeScript check
 *
 * Either outcome is bad. This module augmentation declares the methods so
 * specs can call `await browser.terminateApp(pkg)` directly, type-checked.
 *
 * Why module augmentation (not a separate utility)
 * ─────────────────────────────────────────────────
 * The WDIO `Browser` interface is what the spec writer sees as `browser`.
 * Augmenting it in the `WebdriverIO` namespace globally means every spec
 * file picks up the additions without explicit imports. This file is
 * automatically discovered by `tsc` because it's a `.d.ts` file in the
 * compilation root (output/) and contains `declare global { … }`.
 *
 * Maintenance
 * ───────────
 * - If WebdriverIO ever ships its own native types for these methods, our
 *   augmentation declaration merges with theirs. TypeScript handles
 *   declaration merging fine; risk is essentially zero. If signatures
 *   differ, the user gets a clear type error rather than silent breakage.
 * - To add a new mobile command (e.g., `installApp`, `removeApp`), append
 *   it to the interface below with the correct signature. Source the
 *   signatures from Appium's command reference, not by guessing.
 *
 * NEVER use `(browser as any).<method>(...)` in spec files or screen
 * objects. If a method you need is missing from this declaration, ADD IT
 * HERE — that's the correct response. Casts to `any` are a HARD RULE
 * violation per code-generation-rules.md §16.
 */

declare global {
  namespace WebdriverIO {
    interface Browser {
      /** Terminate (force-stop) an application on the device. Returns when the app process is killed. */
      terminateApp(bundleId: string): Promise<void>;

      /** Activate (launch or bring-to-foreground) an application on the device. */
      activateApp(bundleId: string): Promise<void>;

      /**
       * Query the running state of an app on the device.
       * Returns: 0 = not installed, 1 = not running, 2 = running in background suspended,
       *          3 = running in background, 4 = running in foreground.
       */
      queryAppState(bundleId: string): Promise<number>;

      /** Hide the on-screen keyboard. No-op if keyboard is already hidden. */
      hideKeyboard(): Promise<void>;

      /** Check whether the on-screen keyboard is currently shown. */
      isKeyboardShown(): Promise<boolean>;
    }
  }
}

// This empty export turns the file into a module — required by TypeScript
// for the `declare global { … }` block to be picked up correctly.
export {};
