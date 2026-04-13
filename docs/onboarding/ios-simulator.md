# Onboarding — iOS Simulator

This guide walks through setting up the Agentic QE Framework v2 to run mobile tests against an iOS Simulator on a macOS machine.

**Target audience:** QE engineers with a Mac who need to test iOS apps without requiring a physical iPhone/iPad.

**Estimated time:** 60-90 minutes (mostly the Xcode download, which is ~10-15 GB).

**Assumption:** you have already completed the core framework setup from the [main README](../../README.md#setup) — `npm install`, `npm run setup`, VS Code with GitHub Copilot installed, Node 18+ verified.

> **⚠️ macOS-only guide:** iOS testing requires macOS hardware because Xcode, the iOS Simulator, and WebDriverAgent are macOS-exclusive. Neither Windows (WSL 2, Git Bash, or native PowerShell) nor Linux can run this guide. **If you're on Windows or Linux and need iOS coverage, use [cloud-farms.md](cloud-farms.md)** (BrowserStack / Sauce Labs / LambdaTest provide cloud-hosted iOS devices without needing a Mac) **or [aws-device-farm.md](aws-device-farm.md)**. The cloud providers handle WebDriverAgent signing server-side, skipping the hardest part of iOS setup entirely.

---

## ⚠️ iOS Support Status — Read This First

> The framework's mobile infrastructure (capabilities, locator loader, BaseScreen gestures, platform-keyed JSON) supports iOS by design. **However, iOS has not been device-verified by the framework maintainers as of the current release.** All 9 mobile parity verification tests and the Flipkart end-to-end regression were run on Android only.
>
> This iOS Simulator guide is written from Apple's official documentation and the Appium XCUITest driver's published reference — it should be reliable enough to get you started. However, you should expect:
>
> - **First-run friction** that isn't in the Android guides because the maintainers haven't walked every step on a real Mac
> - **Some `BaseScreen` methods are Android-only** and need iOS-specific replacements (see "Known iOS Gaps" section below)
> - **Most existing locator JSON files in the repo only have `android:` sub-objects** — running existing cross-platform scenarios on iOS will surface missing `ios:` entries that you'll need to fill in
> - **The framework's parity verification specs are Android-only today** — there's no equivalent iOS smoke test you can run to confirm the stack works
>
> Please contribute your fixes back via pull request, and update `scenarios/app-contexts/{app}-ios.md` with any iOS-specific patterns you discover. Your first iOS run is also the team's first iOS run — you're a pioneer here.

---

## 0. Prerequisites — What You Need Before Starting

| Need | Why | Verify |
|---|---|---|
| **macOS** (11 Big Sur or later, ideally 13 Ventura or 14 Sonoma) | Xcode only runs on macOS — iOS Simulator is not available on Windows or Linux | `sw_vers -productVersion` |
| **Admin rights** (or IT approval for Xcode install) | Xcode installs to `/Applications` and requires user approval for Command Line Tools | Try to run `xcode-select --install` — if it prompts for an admin password and your user can provide one, you're good |
| **25+ GB of free disk space** | Xcode itself is ~10-15 GB, plus simulator runtimes (~3-5 GB each), plus the framework's `output/node_modules` | `df -h /` |
| **Apple ID** | Required to download Xcode from the App Store | If your corporate Mac has a shared Apple ID for IT downloads, ask for access |
| **Node.js 18+** | Framework requirement | `node --version` |
| **Homebrew** | Easiest way to install Carthage (used by Appium's WDA dependency builds) | `brew --version` — if missing, `/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"` |

**Corporate Mac gotcha:** some enterprise Macs have restricted App Store access or block Xcode installs. If you can't install Xcode from the App Store, ask IT for the `.xip` installer from Apple's developer portal (https://developer.apple.com/download/all/) — that path doesn't require App Store access but does require an Apple Developer account (free tier is enough for Simulator testing).

---

## 1. Install Xcode + Command Line Tools

### Step 1 — Install Xcode from the Mac App Store

1. Open the **App Store** application
2. Search for **Xcode**
3. Click **Get** / **Install** — this downloads ~10-15 GB. On a corporate connection, budget 30-60 minutes.
4. When the install completes, open Xcode once to accept the license agreement. It may ask to install additional components — let it.

### Step 2 — Install the Command Line Tools

```bash
xcode-select --install
```

A GUI dialog will appear. Click **Install**, accept the license, wait 5-10 minutes.

### Step 3 — Verify

```bash
xcodebuild -version
# Xcode 15.x
# Build version 15x

xcode-select -p
# /Applications/Xcode.app/Contents/Developer

xcrun simctl list devices available
# == Devices ==
# -- iOS 17.0 --
#     iPhone 15 (B7D4F2...) (Shutdown)
#     iPhone 15 Pro (...) (Shutdown)
#     iPad Air (5th generation) (...) (Shutdown)
# ... (etc)
```

If `xcrun simctl list devices available` prints a list of simulators, your Xcode install is healthy.

**If no devices are listed:** open Xcode → **Settings → Platforms** → click the download icon next to **iOS** to install the default simulator runtime.

---

## 2. Install Carthage (for WebDriverAgent build dependencies)

Appium's XCUITest driver builds WebDriverAgent (WDA) the first time you run a session. WDA uses Carthage to fetch some of its dependencies.

```bash
brew install carthage

# Verify
carthage version
# Should print 0.x.x or 1.x.x
```

**Why Carthage specifically:** Appium WDA's `Package.swift` resolves some SPM packages automatically, but older WDA releases still have Carthage-managed dependencies. Installing Carthage is a one-time safety net — if you skip it, you might hit "carthage: command not found" during the first WDA build.

---

## 3. Install Appium 2.x + XCUITest Driver

```bash
# Global install
npm install -g appium
appium driver install xcuitest

# Verify
appium --version                      # 2.x
appium driver list --installed        # should show xcuitest
```

If `npm install -g appium` fails with `EACCES`, use a user-local prefix (same fix as the Android guides):
```bash
mkdir -p ~/.npm-global
npm config set prefix ~/.npm-global
# Add ~/.npm-global/bin to PATH in ~/.zshrc
npm install -g appium
appium driver install xcuitest
```

---

## 4. Start an iOS Simulator

You have two start paths: the Xcode **Simulator.app** (GUI) or `xcrun simctl` (CLI). Either works — the Simulator.app path is more discoverable your first time.

### Option A — Simulator.app (GUI, recommended first time)

1. Open **Xcode**
2. **Xcode menu → Open Developer Tool → Simulator**
3. Simulator.app opens. If no device is currently active, **File → New Simulator** → pick **iPhone 15** / **iOS 17.0** → **Create**
4. The simulator window appears with the Apple logo, then boots to the home screen (30-60 seconds first time)

### Option B — `xcrun simctl` (CLI)

```bash
# List available simulators (names and UDIDs)
xcrun simctl list devices available

# Boot the iPhone 15 simulator (substitute with a UDID from the list above)
xcrun simctl boot "iPhone 15"
# (If "iPhone 15" isn't a unique name, use the UDID instead)

# Open the Simulator app to see the booted device
open -a Simulator
```

### Verify the simulator is booted and reachable

```bash
xcrun simctl list devices booted
# Should show at least one device in "Booted" state
```

Unlike Android where `adb devices` lists running devices, iOS uses `xcrun simctl list devices booted`. There's no ADB-equivalent port — Appium talks to the simulator through Xcode's developer tools directly.

---

## 5. Install the App Under Test in the Simulator

iOS apps for the simulator come in two forms:
- **`.app` bundle** — the unpackaged app directory built by Xcode. This is what you'd get from your iOS developers or a Simulator CI build.
- **`.ipa` file** — the packaged app for App Store / TestFlight distribution. **`.ipa` files do NOT work on the Simulator — they're built for physical devices.** If your team only has a `.ipa`, you need a separate Simulator build.

### Pattern A — Install a `.app` bundle via `simctl`

```bash
# Install
xcrun simctl install booted /path/to/YourApp.app

# Launch
xcrun simctl launch booted com.example.yourapp

# Extract the bundle ID if you don't know it
# The bundle ID is in the Info.plist:
/usr/libexec/PlistBuddy -c "Print CFBundleIdentifier" /path/to/YourApp.app/Info.plist
```

### Pattern B — Install fresh via `APP_PATH` (let Appium handle it)

Skip the `simctl install` — set `IOS_APP_PATH` in `.env` and Appium's XCUITest driver installs the `.app` at the start of every session.

### Pattern C — App already installed (from a previous run)

Just know its bundle ID. You can list installed apps:
```bash
xcrun simctl listapps booted
# Outputs a JSON dict keyed by bundle ID
```

---

## 6. Configure `output/.env`

```bash
cd output
cp .env.example .env          # if .env doesn't exist yet
```

Edit `output/.env` and add the iOS mobile block:

```env
# --- Mobile (Appium) ---
PLATFORM=ios
APPIUM_HOST=localhost
APPIUM_PORT=4723
NO_RESET=true

# --- iOS device ---
IOS_DEVICE=iPhone 15               # simulator name from `xcrun simctl list devices`
IOS_VERSION=17.0                   # iOS version (must match an installed simulator runtime)
# IOS_UDID is optional for simulators — only required for real devices. Leave empty here.
IOS_UDID=

# --- App under test ---

# Pattern A or C — pre-installed app
IOS_BUNDLE_ID=com.example.yourapp

# Pattern B — install fresh .app each session (uncomment instead of IOS_BUNDLE_ID)
# IOS_APP_PATH=/absolute/path/to/YourApp.app
```

### Verify your config before running tests

```bash
# Manually launch the app in the simulator
xcrun simctl launch booted com.example.yourapp
```

If the app launches, your `IOS_BUNDLE_ID` is correct.

---

## 7. Configure MCP Servers (VS Code Copilot)

Same structure as the Android guides — the Appium MCP server handles both Android and iOS.

```bash
cp .vscode/mcp.example.json .vscode/mcp.json
```

The default content should work out of the box. If you use nvm/fnm/volta for Node, replace `"command": "npx"` with the absolute path from `which npx` (see [android-emulator.md § 6](android-emulator.md#6-configure-mcp-servers-vs-code-copilot) for details).

**Important for iOS:** the Appium MCP server doesn't need `ANDROID_HOME` for iOS-only testing, but the example JSON includes that env var. Leaving it empty or pointing at a non-existent path is fine — the XCUITest driver ignores it.

After editing, reload the VS Code window: `Ctrl+Shift+P` → **Developer: Reload Window**.

---

## 8. Start Appium

```bash
appium
```

Leave running in a separate terminal. Verify:
```bash
curl http://localhost:4723/status
# Should return { "value": { "ready": true, ... } }
```

---

## 9. First Run — Expect a One-Time WebDriverAgent Build

The first time Appium's XCUITest driver connects to a simulator, it builds **WebDriverAgent (WDA)** — the small iOS app that Appium uses as its automation runner. This is automatic but **takes 2-5 minutes on the first run** and may print a lot of Xcode build output.

**What you'll see in the Appium terminal on the first session:**
```
[XCUITest] Starting WebDriverAgent session
[WebDriverAgent] Using Xcode...
[WebDriverAgent] Building WebDriverAgent...
[WebDriverAgent]    CompileAssetCatalog ...
[WebDriverAgent]    CompileC ...
[WebDriverAgent]    ProcessInfoPlistFile ...
[WebDriverAgent] ** BUILD SUCCEEDED **
```

On subsequent runs, WDA is cached and sessions start in under 30 seconds.

**If the WDA build fails**, see the iOS-specific troubleshooting section below — the common causes are Xcode version mismatches and code-signing issues (which don't apply to Simulator but can be triggered by stale cached state).

---

## 10. Smoke Test — No Parity Verification Specs for iOS Yet

The framework's parity verification specs in `output/tests/mobile/parity/` are all tagged `@android-only`. There's no equivalent iOS smoke test in the repo as of the current release — when you write the first iOS scenario, you'll essentially be establishing the iOS baseline yourself.

**Workaround for a quick end-to-end sanity check**, until an iOS parity spec is contributed: write a minimal 3-step scenario that launches your app and verifies a single element is displayed. If that passes, your whole stack is functional.

---

## 11. Write and Run Your First iOS Scenario

### Create the scenario file

```bash
mkdir -p scenarios/mobile/my-app
cat > scenarios/mobile/my-app/ios-launch-smoke.md << 'EOF'
# Scenario: My App — iOS Launch Smoke Test

## Metadata
- **Module:** Smoke Tests
- **Priority:** P0
- **Type:** mobile
- **Platform:** ios
- **Tags:** mobile, smoke, ios, P0

## Application
- **Bundle ID (iOS):** {{ENV.IOS_BUNDLE_ID}}
- **Device:** {{ENV.IOS_DEVICE}}

## Pre-conditions
- App installed on the iOS Simulator
- Appium server running

## Steps
1. Launch the app
2. Wait for the home screen to load
3. VERIFY: The app's main navigation element is displayed
4. SCREENSHOT: ios-launch-smoke
EOF
```

Note the `Platform: ios` header — this emits `@ios-only` in the generated spec's describe title, so you filter it correctly at runtime.

### Run the Explorer (VS Code Copilot chat)

```
@QE Explorer Run Explorer for scenario ios-launch-smoke, type mobile, folder my-app.
Input: scenarios/mobile/my-app/ios-launch-smoke.md
```

The Explorer connects via Appium MCP to the running simulator and walks the steps. Because iOS uses different locator strategies than Android (accessibility_id > id > class_chain > predicate_string > xpath), the locator JSON the Explorer produces will have `ios:` sub-objects per element.

### Run the Builder

```
@QE Builder Run Builder for scenario ios-launch-smoke, type mobile, folder my-app.
Input: scenarios/mobile/my-app/ios-launch-smoke.enriched.md
```

### Run the test

```bash
cd output
PLATFORM=ios npx wdio run wdio.conf.ts \
  --spec tests/mobile/my-app/ios-launch-smoke.spec.ts \
  --mochaOpts.grep "@ios-only|@cross-platform"
```

**Note the filter** — `@ios-only|@cross-platform` (not `@android-only`). This ensures Android-only specs are skipped when running on iOS.

---

## 12. Known iOS Gaps — `BaseScreen` Methods That Are Android-Only

The framework's `BaseScreen` class has two methods that currently hardcode Android UiAutomator selectors and will fail on iOS:

### `BaseScreen.selectOption(elementKey, value)`

This method uses `android=new UiSelector().text(...)` to open a native Android Spinner dropdown. iOS doesn't have Spinners — it uses UIPickerView (picker wheels) with completely different interaction patterns.

**Workaround for iOS:** write a screen-specific helper in your `*.helpers.ts` file:

```typescript
// output/screens/SettingsScreen.helpers.ts
import { SettingsScreen } from './SettingsScreen';

export function applyHelpers(screen: SettingsScreen) {
  return Object.assign(screen, {
    async selectPickerOption(pickerKey: string, optionText: string) {
      const picker = await this.loc.get(pickerKey);
      await picker.click();
      // iOS picker-wheel interaction — scroll through wheel to find the option
      const option = await this.driver.$(`-ios predicate string:type == "XCUIElementTypePickerWheel" AND value BEGINSWITH "${optionText}"`);
      await option.waitForExist({ timeout: 5000 });
      // For pickers, iOS uses setValue() to scroll to the target value
      await option.setValue(optionText);
    }
  });
}
```

Use `applyHelpers(new SettingsScreen(browser)).selectPickerOption('countryPicker', 'United States')` in your spec.

### `BaseScreen.waitForActivity(activityName)`

This method calls `getCurrentActivity()` which is Android-only (iOS has no concept of Activities — iOS apps are built around ViewControllers + scenes).

**Workaround for iOS:** replace `waitForActivity` calls with a stable-element wait:

```typescript
// Instead of:
await screen.waitForActivity('SettingsActivity');

// Use:
await screen.waitForElement('settingsHeader', 'displayed', 10000);
```

Pick an element that's unique to the target screen and use it as the navigation landmark.

### Contribution welcome

If you build reusable iOS patterns for picker wheels, navigation waits, or other Android-centric `BaseScreen` methods, please contribute them back to `templates/core-mobile/base-screen.ts` (wrap in a platform check so Android behavior is preserved).

---

## 13. iOS Simulator Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `xcrun simctl list devices available` shows no devices | iOS Simulator runtime not installed | Open Xcode → Settings → Platforms → click the download icon next to iOS |
| First Appium session hangs at "Building WebDriverAgent..." for 10+ minutes | Xcode is downloading additional components or the build is actually progressing (it's slow first time) | Wait. Watch the Appium terminal — you should see line-by-line build progress. If it's genuinely stuck (no new output for 5+ minutes), see the next row. |
| WDA build fails with "No such file or directory: carthage" | Carthage not installed | `brew install carthage` and retry the Appium session |
| WDA build fails with "Code signing is required for product type 'Application'" | Xcode is trying to sign WDA even for Simulator (shouldn't) | Clear cached WDA builds: `rm -rf ~/Library/Developer/Xcode/DerivedData/WebDriverAgent-*` and retry. If persistent, open `~/.appium/node_modules/appium-xcuitest-driver/node_modules/appium-webdriveragent/WebDriverAgent.xcodeproj` in Xcode and build the WebDriverAgentRunner target manually once. |
| Appium session starts but every element lookup returns "no such element" | XCUITest driver not attached to the right app | Verify `IOS_BUNDLE_ID` matches what's actually running. `xcrun simctl listapps booted` to see installed bundle IDs. |
| `xcrun simctl install` fails with "Unable to install" | The `.app` bundle was built for a different architecture (Intel vs Apple Silicon) | Rebuild the `.app` for your Mac's architecture. Apple Silicon Macs need arm64 Simulator builds; Intel Macs need x86_64. |
| Tests pass once but fail on re-run with "element not found" | Simulator state persisted between runs and the app is in a different screen | The framework's `wdio.conf.ts` `beforeSuite` hook should handle this via `terminateApp + activateApp`. If it's not working on iOS, check that the hook's `terminateApp(appPackage)` call works — iOS uses bundle IDs, not package names. You may need a platform check in the hook. |
| Simulator is slow, tests take 2-3× longer than expected | Running an x86_64 simulator on an Apple Silicon Mac under Rosetta emulation | Pick an arm64-native simulator (they're the default on Apple Silicon). Check via `xcrun simctl list runtimes` — the arm64 runtime is the one to use. |
| Corporate Mac won't let you install Xcode | IT policy or App Store restriction | File an IT ticket. Alternatives: download the Xcode `.xip` from Apple Developer portal (requires a free Apple Developer account) and install manually to `/Applications`. |

---

## What You Have Now

- macOS with Xcode + Command Line Tools installed
- At least one iOS Simulator booted and visible in `xcrun simctl list devices booted`
- Appium 2.x with XCUITest driver installed
- Carthage installed (for WDA builds)
- Your app installed in the simulator via `xcrun simctl install` or `IOS_APP_PATH`
- `output/.env` with the iOS block filled in
- `.vscode/mcp.json` configured, VS Code reloaded
- Appium server running on localhost:4723
- A first iOS scenario authored + run through Explorer → Builder → test execution
- Awareness of the known iOS gaps (Android-only `BaseScreen` methods) and how to work around them

**Contribution ask:** your first successful iOS run should be followed by:
1. Committing the generated `ios:` locator sub-objects to `scenarios/app-contexts/{your-app}-ios.md`
2. Opening a pull request with any iOS-specific patterns you discovered
3. Writing at least one iOS parity verification spec under `output/tests/mobile/parity/ios/` so the next person has a smoke test to run

**Next:** read the [Mobile Test Automation](../../README.md#mobile-test-automation) section for deeper material, and review the [iOS Support Status](../../README.md#ios-support-status) in the main README for ongoing known gaps.
