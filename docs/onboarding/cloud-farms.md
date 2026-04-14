# Onboarding — Cloud Device Farms (BrowserStack, Sauce Labs, LambdaTest)

This guide covers setting up the Agentic QE Framework v2 to run mobile tests on cloud-hosted device farms. The three major providers — **BrowserStack App Automate**, **Sauce Labs**, and **LambdaTest** — share virtually identical integration patterns, so this guide covers all three in one place with a comparison table and per-vendor configuration examples.

**Target audience:** teams that need real-device coverage across many Android + iOS models without maintaining a physical device lab, or teams running CI/CD pipelines without dedicated device hardware.

**Estimated time:** 20-40 minutes for first-time setup + first green run (walkthrough-verified 2026-04-14 on BrowserStack with a minimal smoke spec). The minimum viable path is: sign up → install WDIO service → set auth env vars → upload one APK + one IPA → write a 10-line smoke spec → run. Expect **Android sessions to take ~20-30 seconds** on a hot device pool, and **iOS sessions to take 90-120 seconds** the first time due to WebDriverAgent install overhead — iOS is normally 3-5× slower per session than Android regardless of how minimal the test is.

**When to use a cloud farm vs local emulator/device:**
- ✅ You need cross-device coverage (Pixel 8 + Galaxy S23 + iPhone 15 + iPad Pro all in one test run)
- ✅ You're running CI/CD and don't have physical devices at the CI runner
- ✅ You need iOS testing but don't want to deal with Apple Developer account + WDA signing ([ios-device.md](ios-device.md) friction)
- ✅ You need geographic distribution (test from EU vs US vs APAC devices)
- ✅ Your corporate policy forbids bringing personal devices into the building
- ❌ You're rapidly iterating during development — local emulator is faster feedback
- ❌ Your test volume is high and cost-per-minute would exceed your budget
- ❌ Your app needs hardware features not exposed by the cloud SDK (specific sensors, Bluetooth peripherals, etc.)

**Assumption:** you have already completed the core framework setup from the [main README](../../README.md#setup) — `npm install`, `npm run setup`, VS Code with GitHub Copilot installed, Node 18+ verified.

> **📘 Cross-platform note — Windows users:** this guide uses Unix-style shell syntax for `export VAR=...` (setting auth env vars) and `curl` (uploading app bundles to vendor storage). The fastest path to follow it unchanged is to run the commands inside **WSL 2** (Windows Subsystem for Linux) or **Git Bash** (bundled with [Git for Windows](https://git-scm.com/download/win)) — in both, every example below works as-written. If you prefer **native PowerShell**, the auth env var examples are translated inline below. `curl` is available natively in Windows 10+ PowerShell, so the app-upload commands work identically in PowerShell with minor quote-escaping. `npm`, `npx wdio`, and the framework CLI are all cross-platform. For CI secrets (GitHub Actions, Azure DevOps, etc.), use your CI provider's native secret management regardless of shell.

> **⚠️ Golden rule — always `cd output` before running `npx wdio` commands.** The framework's WDIO config, test specs, and `node_modules` all live under `output/`. Running `npx wdio` from the project root will trigger WDIO's interactive setup wizard (it won't find a config) and try to scaffold a new test project in the wrong place. If you see a wizard prompt, press `Ctrl+C`, `cd output`, and retry.

---

## 0. Vendor Comparison

All three providers are mature, documented, and actively maintained as of the current release. The integration pattern with WDIO + Appium is ~80% identical across them — only the vendor-specific capability key, service name, app upload URL, and auth env vars differ.

| Feature | BrowserStack App Automate | Sauce Labs | LambdaTest |
|---|---|---|---|
| **WDIO service** | `@wdio/browserstack-service` (official) | `@wdio/sauce-service` (official) | `wdio-lambdatest-service` (community) |
| **Vendor capability key** | `'bstack:options'` | `'sauce:options'` | `'lt:options'` |
| **Auth env vars** | `BROWSERSTACK_USERNAME`, `BROWSERSTACK_ACCESS_KEY` | `SAUCE_USERNAME`, `SAUCE_ACCESS_KEY` | `LT_USERNAME`, `LT_ACCESS_KEY` |
| **App upload API** | `POST https://api-cloud.browserstack.com/app-automate/upload` | `POST https://api.us-west-1.saucelabs.com/v1/storage/upload` | `POST https://manual-api.lambdatest.com/app/upload/realDevice` |
| **App reference format** | `bs://<app-id>` | `storage:filename=app.apk` | `lt://APP1016...` |
| **Device pool size** (typical) | 3000+ real devices across Android + iOS | 1000+ real devices | 3000+ real devices |
| **Simulator / emulator support** | Yes — "Browser Testing" separates real-device vs simulated | Yes | Yes |
| **Android versions available** | 6.0 – 14.0+ | 7.0 – 14.0+ | 7.0 – 14.0+ |
| **iOS versions available** | 11 – 17+ | 13 – 17+ | 13 – 17+ |
| **Concurrent sessions** (depends on plan) | 1-50+ | 1-40+ | 1-50+ |
| **Free trial** | Yes — BrowserStack offers limited free minutes | Yes — 14-day trial | Yes — 60 minutes free |
| **Enterprise features** | SSO, IP whitelisting, dedicated devices, private cloud | Same | Same |
| **Price range** (as of early 2026) | $99-$199/mo starter, enterprise on request | $79-$249/mo starter | $49-$199/mo starter |
| **Best-known-for** | Market leader, broadest device catalog, strong UI for manual debugging | Strong CI integration, detailed analytics | Price-competitive, generous free tier |

**My recommendation if you're undecided:** try BrowserStack first for evaluation — the UI for reviewing failed test runs (screenshots + video + logs all in one place) is the most polished of the three. For production CI where cost matters more than UX polish, LambdaTest is often the cheapest per minute. Sauce Labs has the tightest WDIO integration among the three.

---

## 1. Prerequisites

| Need | All three | BrowserStack-specific | Sauce Labs-specific | LambdaTest-specific |
|---|---|---|---|---|
| Node 18+ | ✓ | | | |
| `npm install` completed + `npm run setup` run | ✓ | | | |
| A built APK (Android) or signed IPA (iOS) | ✓ | | | |
| Cloud provider account | ✓ | BS Dashboard access | Sauce UI access | LT Dashboard access |
| Username + access key in env vars | ✓ | `BROWSERSTACK_USERNAME` + `BROWSERSTACK_ACCESS_KEY` | `SAUCE_USERNAME` + `SAUCE_ACCESS_KEY` | `LT_USERNAME` + `LT_ACCESS_KEY` |
| Network egress allowed from your CI/laptop to the vendor's cloud endpoint | ✓ (verify `curl` to the vendor's auth endpoint) | `hub-cloud.browserstack.com` on port 443 | `ondemand.us-west-1.saucelabs.com` on port 443 | `hub.lambdatest.com` on port 443 |

**Corporate firewall gotcha:** many enterprise networks block outbound connections to cloud testing providers by default. Before starting, confirm with IT that egress is allowed to the vendor endpoint your plan uses. Each vendor has regional endpoints (US, EU, APAC) — pick the one closest to your CI runner for lowest latency.

---

## 2. Install the WDIO Service

Pick the service that matches your chosen provider. You only need one.

### BrowserStack

```bash
cd output
npm install --save-dev @wdio/browserstack-service
```

### Sauce Labs

```bash
cd output
npm install --save-dev @wdio/sauce-service
```

### LambdaTest

```bash
cd output
npm install --save-dev wdio-lambdatest-service
```

**Note:** LambdaTest's service is a community package (not `@wdio/`-scoped) but it's maintained and officially recommended by LambdaTest's docs.

---

## 3. Upload Your App

Each vendor has its own upload API and returns a vendor-specific URL that you paste into the capabilities. Upload the APK/IPA once per app version (not per test run).

> **⚠️ Order of operations:** the upload commands below use `$BROWSERSTACK_USERNAME` and `$BROWSERSTACK_ACCESS_KEY` (or equivalent env vars for Sauce Labs / LambdaTest). You must set those env vars **BEFORE** running the upload — jump to [§ 4 Set Authentication Env Vars](#4-set-authentication-env-vars) first, set them, then come back here. The sections are numbered 3 → 4 for reference-reading, but the workflow order is 4 → 3.

### Trial Quick-Start — Use BrowserStack's Published Sample Apps

If you don't yet have your own APK/IPA (first-time trial, evaluation run), BrowserStack publishes two free sample apps you can use to validate the entire cross-platform pipeline in under 20 minutes:

| Sample | Platform | Download URL |
|---|---|---|
| `WikipediaSample.apk` | Android | https://www.browserstack.com/app-automate/sample-apps/android/WikipediaSample.apk |
| `BStackSampleApp.ipa` | iOS | https://www.browserstack.com/app-automate/sample-apps/ios/BStackSampleApp.ipa |

**⚠️ These are DIFFERENT apps**, not the same app cross-built for both platforms. WikipediaSample is a Wikipedia search UI; BStackSampleApp is an e-commerce demo. This means a single cross-platform scenario **cannot drive both apps' business logic** — you'd need two separate app-specific scenarios OR an **app-agnostic smoke spec** that only validates "session creation + screenshot" without touching any UI element.

**The framework ships an app-agnostic smoke spec ready to use** at [`output/tests/mobile/browserstack-trial/smoke-cross-platform.spec.ts`](../../output/tests/mobile/browserstack-trial/smoke-cross-platform.spec.ts). It tags itself `@cross-platform`, runs on any Appium-compatible app (cloud or local), and validates the full pipeline (session → driver → device → screenshot) in ~3 seconds of actual test time per platform. This is the fastest path to a green cross-platform run for trial evaluation.

**Download and upload the two sample apps:**

```bash
# Download to /tmp (this step doesn't need your BrowserStack credentials)
curl -L -o /tmp/WikipediaSample.apk https://www.browserstack.com/app-automate/sample-apps/android/WikipediaSample.apk
curl -L -o /tmp/BStackSampleApp.ipa https://www.browserstack.com/app-automate/sample-apps/ios/BStackSampleApp.ipa

# Upload (requires $BROWSERSTACK_USERNAME and $BROWSERSTACK_ACCESS_KEY from § 4)
curl -u "$BROWSERSTACK_USERNAME:$BROWSERSTACK_ACCESS_KEY" \
  -X POST "https://api-cloud.browserstack.com/app-automate/upload" \
  -F "file=@/tmp/WikipediaSample.apk" \
  -F "custom_id=WikipediaSample-trial"

curl -u "$BROWSERSTACK_USERNAME:$BROWSERSTACK_ACCESS_KEY" \
  -X POST "https://api-cloud.browserstack.com/app-automate/upload" \
  -F "file=@/tmp/BStackSampleApp.ipa" \
  -F "custom_id=BStackSampleApp-trial"
```

**Save both `app_url` values** (the two `bs://<hex-id>` strings from the responses) — you'll paste them into `wdio.browserstack.conf.ts` in § 5. The framework ships a [ready-to-use BrowserStack config template](../../output/wdio.browserstack.conf.ts) that already has the placeholder structure — just replace the two `bs://REPLACE-WITH-YOUR-*-APP-ID` strings with your actual URLs.

### BrowserStack — Your Own App

```bash
curl -u "$BROWSERSTACK_USERNAME:$BROWSERSTACK_ACCESS_KEY" \
  -X POST "https://api-cloud.browserstack.com/app-automate/upload" \
  -F "file=@/absolute/path/to/YourApp.apk" \
  -F "custom_id=my-app-v1.2.3"                  # optional — makes the upload reusable by custom ID
```

Response:
```json
{
  "app_url": "bs://abc123def456...",
  "custom_id": "my-app-v1.2.3",
  "shareable_id": "user/my-app-v1.2.3"
}
```

**Save the `app_url`** — you'll paste it into `wdio.conf.ts`.

**iOS:** same command, just point `file=@` at a signed `.ipa` file. BrowserStack handles the re-signing for real-device runs.

### Sauce Labs

```bash
curl -u "$SAUCE_USERNAME:$SAUCE_ACCESS_KEY" \
  --location \
  --request POST 'https://api.us-west-1.saucelabs.com/v1/storage/upload' \
  --form 'payload=@"/absolute/path/to/YourApp.apk"' \
  --form 'name="YourApp.apk"'
```

Response includes an `id` field. Sauce references uploaded apps via `storage:filename=<name>` or `storage:<id>`, so you'd use:
```
"appium:app": "storage:filename=YourApp.apk"
```

in your capabilities (next step).

### LambdaTest

```bash
curl -u "$LT_USERNAME:$LT_ACCESS_KEY" \
  -X POST "https://manual-api.lambdatest.com/app/upload/realDevice" \
  -F "name=YourApp.apk" \
  -F "appFile=@/absolute/path/to/YourApp.apk"
```

Response:
```json
{
  "app_url": "lt://APP10160541716...",
  "message": "App Uploaded Successfully"
}
```

Save the `lt://APP...` URL.

### Verification: re-upload check

For all three vendors, run the upload command once and save the returned URL somewhere team-visible (wiki, CI secrets, or a committed `.env.example` for reference). Re-uploading the same file wastes quota — reuse the URL until your app version changes.

---

## 4. Set Authentication Env Vars

Set these in your local shell for development and in your CI secrets for pipeline runs. **Never commit them to git.**

### BrowserStack

**macOS / Linux / WSL 2 / Git Bash** — add to `~/.zshrc` or `~/.bashrc` for persistence:
```bash
export BROWSERSTACK_USERNAME="your-username"
export BROWSERSTACK_ACCESS_KEY="your-access-key"
```

**Windows PowerShell** — session-scoped (current shell only):
```powershell
$env:BROWSERSTACK_USERNAME = "your-username"
$env:BROWSERSTACK_ACCESS_KEY = "your-access-key"
```

**Windows PowerShell** — persistent across sessions (write to user env):
```powershell
[Environment]::SetEnvironmentVariable("BROWSERSTACK_USERNAME", "your-username", "User")
[Environment]::SetEnvironmentVariable("BROWSERSTACK_ACCESS_KEY", "your-access-key", "User")
# Then restart your terminal for the change to take effect
```

Find your BrowserStack credentials at: https://www.browserstack.com/accounts/settings

### Sauce Labs

**macOS / Linux / WSL 2 / Git Bash:**
```bash
export SAUCE_USERNAME="your-username"
export SAUCE_ACCESS_KEY="your-access-key"
```

**Windows PowerShell (session-scoped):**
```powershell
$env:SAUCE_USERNAME = "your-username"
$env:SAUCE_ACCESS_KEY = "your-access-key"
```

**Windows PowerShell (persistent):**
```powershell
[Environment]::SetEnvironmentVariable("SAUCE_USERNAME", "your-username", "User")
[Environment]::SetEnvironmentVariable("SAUCE_ACCESS_KEY", "your-access-key", "User")
```

Find your Sauce Labs credentials at: https://app.saucelabs.com → User icon → User Settings

### LambdaTest

**macOS / Linux / WSL 2 / Git Bash:**
```bash
export LT_USERNAME="your-username"
export LT_ACCESS_KEY="your-access-key"
```

**Windows PowerShell (session-scoped):**
```powershell
$env:LT_USERNAME = "your-username"
$env:LT_ACCESS_KEY = "your-access-key"
```

**Windows PowerShell (persistent):**
```powershell
[Environment]::SetEnvironmentVariable("LT_USERNAME", "your-username", "User")
[Environment]::SetEnvironmentVariable("LT_ACCESS_KEY", "your-access-key", "User")
```

Find your LambdaTest credentials at: https://accounts.lambdatest.com/security

### For CI — GitHub Actions example

```yaml
# .github/workflows/mobile-tests.yml
env:
  BROWSERSTACK_USERNAME: ${{ secrets.BROWSERSTACK_USERNAME }}
  BROWSERSTACK_ACCESS_KEY: ${{ secrets.BROWSERSTACK_ACCESS_KEY }}
```

Never hardcode credentials in `.env`, `wdio.conf.ts`, or any committed file. The framework's [Reviewer Dimension 7 (Security)](../../README.md#quality-assurance) will flag hardcoded credentials as a failing check.

---

## 5. Configure `wdio.conf.ts` — Per-Vendor Examples

The framework's default `output/wdio.conf.ts` is configured for local Appium. For cloud-farm runs, you'll override the `services`, `capabilities`, and optionally `hostname`/`port`. The cleanest way to manage this is to create **separate conf files per vendor** and pass the right one at run time via `npx wdio run wdio.browserstack.conf.ts`.

### Example 1 — BrowserStack (`output/wdio.browserstack.conf.ts`)

> **A ready-to-use template of this file already exists at [`output/wdio.browserstack.conf.ts`](../../output/wdio.browserstack.conf.ts) in the framework's committed state.** The template has placeholder `bs://REPLACE-WITH-YOUR-*-APP-ID` strings that you swap with your own uploaded app URLs, or you can override via the `BROWSERSTACK_ANDROID_APP_URL` / `BROWSERSTACK_IOS_APP_URL` env vars. The block below is the same structure — reproduced here for reference.

```typescript
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load base environment
const env = process.env.TEST_ENV || 'dev';
dotenv.config({ path: path.join(__dirname, `.env.${env}`) });
dotenv.config({ path: path.join(__dirname, '.env') });

// Per-capability app URLs. Use this pattern when you have DIFFERENT apps for
// Android and iOS (e.g., BrowserStack's WikipediaSample + BStackSampleApp).
// If you have the SAME app for both platforms, you can alternatively set
// `app` at the service level (see comment below) instead of per-capability.
const ANDROID_APP_URL =
  process.env.BROWSERSTACK_ANDROID_APP_URL
  || 'bs://REPLACE-WITH-YOUR-ANDROID-APP-ID';

const IOS_APP_URL =
  process.env.BROWSERSTACK_IOS_APP_URL
  || 'bs://REPLACE-WITH-YOUR-IOS-APP-ID';

export const config = {
  runner: 'local',

  // Narrow glob — only pick up cross-platform trial specs, NOT your local
  // Flipkart/parity specs (which are tagged @android-only and would skip anyway).
  specs: ['./tests/mobile/browserstack-trial/**/*.spec.ts'],
  exclude: [],

  // BrowserStack FREE TRIAL = 1 parallel session. Setting to 1 forces
  // capabilities to run sequentially. Increase to your plan's concurrent
  // session cap once you're on a paid plan (typically 2-10 for standard
  // plans, up to 50+ for enterprise).
  maxInstances: 1,

  user: process.env.BROWSERSTACK_USERNAME,
  key: process.env.BROWSERSTACK_ACCESS_KEY,

  services: [
    ['browserstack', {
      // NOTE: NOT setting `app` at the service level. Each capability has its
      // own `appium:app` (per-capability override) below. If you use the SAME
      // app for all capabilities, uncomment this line and delete the
      // `appium:app` entries in each capability block:
      //   app: ANDROID_APP_URL,
      browserstackLocal: false,   // true if testing an app that talks to localhost services
    }],
  ],

  capabilities: [
    {
      // ─── Android ──────────────────────────────────────────────────
      platformName: 'Android',
      'appium:app': ANDROID_APP_URL,   // per-capability app override
      'bstack:options': {
        deviceName: 'Samsung Galaxy S22',
        osVersion: '12.0',
        projectName: 'agentic-qe',
        buildName: `trial-${new Date().toISOString().slice(0, 10)}`,
        sessionName: 'cross-platform-smoke-android',
        appiumVersion: '2.0.1',
      },
    },
    {
      // ─── iOS ──────────────────────────────────────────────────────
      platformName: 'iOS',
      'appium:app': IOS_APP_URL,       // per-capability app override
      'bstack:options': {
        deviceName: 'iPhone 14',
        osVersion: '16',
        projectName: 'agentic-qe',
        buildName: `trial-${new Date().toISOString().slice(0, 10)}`,
        sessionName: 'cross-platform-smoke-ios',
        appiumVersion: '2.0.1',
      },
    },
  ],

  framework: 'mocha',
  mochaOpts: {
    ui: 'bdd',
    timeout: 300000,   // 5 min — iOS sessions can take 90-120s to provision before test starts
  },
  reporters: [
    'spec',
    ['json', {
      outputDir: './test-results',
      outputFileFormat: () => 'browserstack-trial-results.json',
    }],
  ],
  waitforTimeout: 15000,
  waitforInterval: 500,
  logLevel: 'info',

  // Intentionally NO `beforeSuite` hook here — cloud-farm sessions already
  // start each test with a fresh app launch. The local wdio.conf.ts uses
  // terminateApp + activateApp to handle NO_RESET=true contamination on
  // local emulators; BrowserStack does that automatically.
};
```

**Two patterns for the `app` setting:**

- **Per-capability `appium:app`** (shown above) — use when you have **different apps** for Android and iOS, e.g., BrowserStack's two published sample apps (`WikipediaSample.apk` for Android + `BStackSampleApp.ipa` for iOS), or your own Android APK + iOS IPA when the apps are genuinely different builds.
- **Service-level `app`** — use when you have the **same app** cross-built for both platforms. Set it once in the `services[0][1].app` field and every capability inherits it. Useful for React Native / Flutter / cross-platform Xamarin apps where one codebase produces both APK and IPA from the same build pipeline.

### Example 2 — Sauce Labs (`output/wdio.saucelabs.conf.ts`)

Same structure — only the vendor key and service name differ:

```typescript
export const config = {
  // ... (same dotenv, specs, runner, mochaOpts as BrowserStack example above)

  user: process.env.SAUCE_USERNAME,
  key: process.env.SAUCE_ACCESS_KEY,
  region: 'us-west-1',          // Sauce regional endpoint

  services: ['sauce'],

  capabilities: [
    {
      platformName: 'Android',
      'appium:app': 'storage:filename=YourApp.apk',
      'sauce:options': {
        deviceName: 'Google Pixel 8',
        platformVersion: '14.0',
        appiumVersion: '2.0.1',
        build: `mobile-regression-${process.env.GITHUB_RUN_NUMBER || 'local'}`,
        name: 'flipkart-checkout',
      },
    },
    // Add more Android and iOS capabilities the same way...
  ],
};
```

### Example 3 — LambdaTest (`output/wdio.lambdatest.conf.ts`)

```typescript
export const config = {
  // ... (same dotenv, specs, runner, mochaOpts)

  user: process.env.LT_USERNAME,
  key: process.env.LT_ACCESS_KEY,

  services: ['lambdatest'],

  capabilities: [
    {
      platformName: 'Android',
      'appium:app': 'lt://APP10160541716...',      // from LT upload response
      'lt:options': {
        deviceName: 'Pixel 8',
        platformVersion: '14',
        appiumVersion: '2.0.1',
        project: 'agentic-qe',
        build: `mobile-regression-${process.env.GITHUB_RUN_NUMBER || 'local'}`,
        name: 'flipkart-checkout',
      },
    },
  ],
};
```

**All three share the same WDIO + Mocha + mochaOpts + reporters setup** — only `services`, `user`, `key`, and the `'<vendor>:options'` key differ. You can copy the BrowserStack file and sed-replace the vendor-specific parts to produce the Sauce and LambdaTest variants in about 5 minutes.

---

## 6. Run Tests Against the Cloud Farm

```bash
cd output     # ALWAYS — see the Golden Rule callout at the top of this guide

# Make sure your auth env vars are set
echo $BROWSERSTACK_USERNAME      # should NOT be empty

# Run against BrowserStack — the config's specs glob picks up the trial spec
npx wdio run wdio.browserstack.conf.ts

# Same run, with an explicit spec and grep filter (useful for running a
# specific scenario when you have multiple trial specs)
npx wdio run wdio.browserstack.conf.ts \
  --spec tests/mobile/browserstack-trial/smoke-cross-platform.spec.ts \
  --mochaOpts.grep "@cross-platform"

# Against Sauce Labs / LambdaTest — same pattern, different config file
npx wdio run wdio.saucelabs.conf.ts
npx wdio run wdio.lambdatest.conf.ts
```

**⚠️ `PLATFORM=android` is NOT needed for cloud-farm runs.** The local `output/wdio.conf.ts` uses the `PLATFORM` env var to switch between `androidCapabilities` and `iosCapabilities` in `output/core/capabilities.ts` (for local Appium). Cloud-farm configs (`wdio.browserstack.conf.ts`, etc.) hardcode the full capabilities array with per-capability `platformName`, so the `PLATFORM` env var has no effect. If you see `PLATFORM=android` in your cloud run command, it's harmless but unnecessary — drop it for clarity.

**Default behavior with multiple capabilities:** WDIO runs ALL specs on ALL capabilities = cross-device coverage. A single spec file with 2 capabilities (Android + iOS) executes 2 times, once per platform. With `maxInstances: 1` (BrowserStack free trial), they run sequentially. With `maxInstances: N` (paid plans), they run in parallel up to N concurrent sessions.

**For sharded speed-up** (run each spec on ONE device, total time = total_specs / N): use `--shard X/N` from N parallel CI jobs, each with a single-device capabilities list. See the main README's [Multi-Device Parallelism](../../README.md#multi-device-parallelism) section.

### Viewing Results on the Cloud Dashboard

All three providers auto-print a **build URL** at the end of every run — watch the final lines of your WDIO console output for something like:

```
Visit https://automation.browserstack.com/builds/<build-id> to view build report, insights, and many more debugging information all at one place!
```

Click the link (or copy it into your browser) to land on the build detail page. Inside a build, you'll see one session entry per capability that ran. Each session has:

- **Video** — playable recording of the device screen during the test. This is the most important debugging artifact — if the video shows your app launching and rendering correctly but the test still fails, you've narrowed the problem to your spec assertions (not the device/app/driver).
- **Logs Timeline** — chronological list of every Appium command your spec sent (`newSession`, `getWindowSize`, `findElement`, `click`, `takeScreenshot`, `deleteSession`) plus their responses. Expandable per-command.
- **Network Logs** — HTTP traffic from the app under test (if the app made any network calls during the session).
- **App Performance** — CPU / memory / battery metrics from the device during the session. Useful for perf-sensitive scenarios.
- **Other Logs** (dropdown) — sub-tabs for:
  - **Device** — Android logcat / iOS syslog output from the device during the session (noisy but useful for debugging real scenarios)
  - **Appium** — raw Appium server logs (lower-level than Logs Timeline)
  - **Terminal** — your spec's `console.log(...)` output as it ran
  - **Raw Logs** — everything else combined, useful for sending to vendor support

**Walkthrough tip:** for a simple smoke test, the Video tab alone is usually enough to confirm the pipeline works. Dive into Logs Timeline / Other Logs only when debugging a failing scenario.

**Note on dashboard UI:** BrowserStack (and the other vendors) occasionally rename and rearrange these tabs. The labels above match the April 2026 UI. If you see different labels, the information is still there — look for "logs," "video," and "screenshots" keywords in the tab list.

---

## 7. CI Integration — GitHub Actions Example

```yaml
# .github/workflows/mobile-cloud-tests.yml
name: Mobile Cloud Tests

on:
  push:
    branches: [main]
  pull_request:

jobs:
  browserstack:
    runs-on: ubuntu-latest
    env:
      BROWSERSTACK_USERNAME: ${{ secrets.BROWSERSTACK_USERNAME }}
      BROWSERSTACK_ACCESS_KEY: ${{ secrets.BROWSERSTACK_ACCESS_KEY }}
      BROWSERSTACK_APP_URL: ${{ secrets.BROWSERSTACK_APP_URL }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }

      - name: Install dependencies
        run: |
          npm install
          npm run setup
          cd output && npm install

      - name: Run mobile tests on BrowserStack
        working-directory: output
        run: |
          PLATFORM=android npx wdio run wdio.browserstack.conf.ts \
            --mochaOpts.grep "@android-only|@cross-platform"

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: browserstack-results
          path: output/test-results/
```

**App upload in CI:** upload your APK to BrowserStack as part of the CI workflow (before running tests), save the returned `bs://` URL to a job-scoped env var, and reference it in `BROWSERSTACK_APP_URL` for the test step. This way every CI run tests the latest build.

```yaml
- name: Upload APK to BrowserStack
  run: |
    RESPONSE=$(curl -u "$BROWSERSTACK_USERNAME:$BROWSERSTACK_ACCESS_KEY" \
      -X POST "https://api-cloud.browserstack.com/app-automate/upload" \
      -F "file=@./app/build/outputs/apk/release/app-release.apk")
    echo "BROWSERSTACK_APP_URL=$(echo $RESPONSE | jq -r '.app_url')" >> $GITHUB_ENV
```

---

## 8. Cloud Farm Troubleshooting

| Symptom | Vendor | Fix |
|---|---|---|
| Authentication fails with "Invalid credentials" | All | Double-check `USERNAME` and `ACCESS_KEY` env vars. For BrowserStack specifically, the key format is UUID-like — make sure you didn't copy a shortened version. |
| "App not found: bs://..." | BrowserStack | The `bs://` URL expired or the app was deleted. Upload again and use the fresh URL. BS uploads expire after 30 days unless you use a `custom_id`. |
| Session starts but times out at "Waiting for session to start" | All | Usually a device pool capacity issue — the requested device is at capacity. Retry, or switch to a less popular device model in your capabilities. |
| Tests run locally but fail on cloud with "Element not found" | All | Cloud devices may have different screen sizes / resolutions / keyboard layouts than your local emulator. Scenario locators that work locally may need platform-keyed variants. Run Explorer against the cloud device to capture vendor-specific locators. |
| "WDA launch failed" on iOS real device in BrowserStack/Sauce/LambdaTest | All (iOS) | Cloud vendors handle WDA signing for you, so this usually means an Appium version mismatch. Try bumping `appiumVersion` in your capabilities to the latest (check vendor docs for supported versions). |
| Test passes on first cloud session, fails on re-run | All | Cloud farms usually give you a fresh session with a fresh app install per test, so state contamination is rare. If it's happening, check that your `'app'` reference is correct and the app isn't being cached in a bad state. |
| Slow session startup on Android (20-30s) | All | Normal for cloud farms — Android provisioning adds 20-30s on top of your test time on a hot device pool. Use `maxInstances` to parallelize and amortize (paid plans only — free trial = 1 parallel). |
| **iOS sessions take 90-120 seconds even for a 3-second test** | All (iOS) | **Normal — not a bug.** iOS provisioning includes WebDriverAgent installation on the cloud device, which the vendor handles automatically but still takes 60-120 seconds every time. This is intrinsic to the Appium XCUITest driver model, not specific to any vendor. Budget ~2 minutes per iOS session regardless of test body length. Walkthrough-measured: Android 22s, iOS 112s for an identical 3-second spec. |
| CI network can't reach cloud endpoint | All | Corporate firewall / egress rules blocking the vendor endpoint. Whitelist the vendor's API domain (`api-cloud.browserstack.com`, `ondemand.us-west-1.saucelabs.com`, `hub.lambdatest.com`) at the network layer. |
| Costs exploding unexpectedly | All | Check your WDIO `--shard` setup — if you're accidentally running all specs on all capabilities, you're consuming N× the minutes you planned. For sharding, use 1 device per capability + `--shard X/N` from N parallel jobs. |
| "Tunnel connection failed" for apps that need localhost access | BrowserStack, Sauce Labs | You need to start the vendor's local tunnel (BrowserStack Local, Sauce Connect) before the test run. Each vendor ships a CLI binary for this — see their docs for tunnel setup. |
| `mocha grep` filter unexpectedly skips tests | All | Mocha's grep is a regex against the full `describe`/`it` title string. Test your regex: `"@android-only\|@cross-platform"` matches tests with EITHER tag. Use `grep -P "@android-only.*@cross-platform"` to require BOTH. |

---

## 9. Cost and Session Management Tips

Cloud farms bill per session-minute. A few practical tips:

- **Use `bail: 1` for smoke tests in CI** to fail-fast and stop consuming minutes on obviously broken builds:
  ```typescript
  // in wdio.<vendor>.conf.ts
  bail: 1,                            // stop after first spec failure
  mochaOpts: { bail: true, timeout: 300000 },
  ```
- **Separate smoke tests from regression tests.** Run smoke tests (5-10 scenarios, <5 min) on every PR. Run full regression (50+ scenarios, 30-60 min) only on main-branch pushes or nightly.
- **Tag scenarios by test type** (`@smoke`, `@regression`, `@P0`, `@P1`) so CI can grep to the right subset per workflow.
- **Keep `maxInstances` at a reasonable number.** Higher = faster but consumes more minutes simultaneously. Match it to your concurrent-session plan limit.
- **Upload the APK once per build** — don't re-upload inside every spec. Use `BROWSERSTACK_APP_URL` (or equivalent) as a CI job env var.
- **Kill runaway sessions** — cloud farms usually kill sessions after 10-30 min of inactivity, but a crashed spec can leak budget. Set a sensible `newCommandTimeout` (120-180s) in Appium capabilities to auto-kill dead sessions faster.
- **Review vendor dashboards weekly** — all three vendors have usage analytics. Look for tests that consistently take longer than expected; those are the first candidates for optimization.

---

## 10. When to Pick Which Vendor — Decision Guide

| Need | Recommended vendor |
|---|---|
| **Broadest device catalog**, especially iOS real devices | BrowserStack |
| **Best free-tier for evaluation** | LambdaTest (60 free minutes) |
| **Strongest CI analytics and failure triage UI** | Sauce Labs |
| **Lowest price per minute for high-volume CI** | LambdaTest |
| **Most polished manual debugging UI** (pause + inspect live session) | BrowserStack |
| **Best enterprise features** (private cloud, dedicated devices, SSO) | All three offer these — pricing varies |
| **Tightest WDIO ecosystem integration** | Sauce Labs (longest WDIO support history) |
| **Teams already using BitBar or Perfecto** | Different vendors entirely — not covered in this guide |

**Honest answer:** for most teams, any of the three will work. The 80% similar pattern means you can switch vendors in a week by copying the conf file and updating 5-6 values. Start with whichever provider your organization already has a contract with, or try all three free tiers and pick the one whose dashboard you find least painful.

---

## 11. What You Have Now

- A cloud farm account with username + access key
- Your APK or IPA uploaded to the vendor's app storage, with a reusable reference URL (`bs://`, `storage:filename=...`, or `lt://`)
- A dedicated `wdio.<vendor>.conf.ts` file with vendor-specific capabilities
- Auth env vars set locally and in CI secrets
- A first successful test run against a cloud device with a passing verification spec
- An understanding of the cost model and the `maxInstances` + `--shard` controls you have

**Next:** if you're running multi-vendor tests (e.g., BrowserStack for release gates + LambdaTest for nightly regression), keep separate `wdio.*.conf.ts` files for each vendor. They evolve independently and having them side-by-side makes diffs obvious when you need to mirror a change.

**Contribution ask:** if you build a working CI workflow for your vendor of choice, consider contributing a sample `ci/workflows/<vendor>-mobile.yml` to the framework's repo. The next team member at your organization (or anyone else cloning this framework) will thank you.
