# Onboarding — Real iOS Device

This guide is a **placeholder with the known-correct setup steps, awaiting first-hand verification on a real iPhone/iPad by the framework maintainers.**

**Target audience:** QE engineers who need to test iOS apps on physical devices (release gates, hardware-dependent features, or real-world performance validation).

**Estimated time:** 2-4 hours on first setup (Apple Developer enrollment alone can take 24+ hours for approval).

> **⚠️ macOS-only guide:** real iOS device testing requires macOS hardware because Xcode, WebDriverAgent code-signing, and device provisioning are macOS-exclusive. Neither Windows (WSL 2, Git Bash, or native PowerShell) nor Linux can complete this setup. **If you're on Windows or Linux and need iOS real-device coverage, use [cloud-farms.md](cloud-farms.md)** (BrowserStack / Sauce Labs / LambdaTest all offer real iOS devices in the cloud) **or [aws-device-farm.md](aws-device-farm.md)**. These cloud providers handle the WebDriverAgent signing ceremony and device provisioning server-side — you skip the hardest 80% of this guide entirely.

---

## ⚠️⚠️ Not Yet Device-Verified — Please Read Carefully

> **The framework has never been run on a physical iOS device by the maintainers as of the current release.** Everything below is based on Apple's documentation, the Appium XCUITest driver's published reference, and general iOS development knowledge — NOT on walked-through first-hand experience with this specific framework.
>
> Real iOS device testing is genuinely the most complex onboarding path because it requires:
> - **An active Apple Developer Program membership** ($99/year individual, $299/year organization) for code-signing — the free Apple ID tier is NOT sufficient for WDA installation on real devices
> - **Xcode provisioning profile management** for both the app under test AND the WebDriverAgent (WDA) runner
> - **Per-device code signing** for WDA, which means re-signing WDA every time you add a new test device to the team's Developer account
> - **Carthage** for WDA dependency builds (same as Simulator, but real-device failures are harder to diagnose)
> - **A developer-approved device** (each test device must be registered in the Apple Developer portal's device list, which is capped at 100 devices per account per year)
>
> **What to expect if you try this guide today:**
> - The Apple Developer enrollment path is correct (it's standard Apple process)
> - The Appium XCUITest driver steps are correct (they're from the driver's official docs)
> - **WDA code-signing is where you're most likely to get stuck** — it's a multi-step Xcode dialog chain that varies by Xcode version, and the error messages can be cryptic
> - **`carthage bootstrap --use-xcframeworks`** is the usual fix for Carthage dependency issues on Apple Silicon Macs, but the exact incantation changes between Xcode versions
> - Some `BaseScreen` methods are Android-only (`selectOption`, `waitForActivity`) — see the [iOS Simulator guide](ios-simulator.md#12-known-ios-gaps--basescreen-methods-that-are-android-only) for the workarounds
>
> **Please contribute your fixes back via pull request.** When you complete a successful first run on a real iOS device, update this guide with the actual steps you walked through, remove the placeholder warnings, and open a PR. Your notes will become the authoritative reference for the next person — **which may be someone on your own team a month from now.**

---

## 0. Prerequisites — What You Need Before Starting

| Need | Why | Notes |
|---|---|---|
| **macOS** (13 Ventura+ recommended) | Xcode + WDA build + device provisioning all require macOS | |
| **Xcode 15+** installed from the App Store | WDA builds against Xcode's iOS SDK | See [ios-simulator.md § 1](ios-simulator.md#1-install-xcode--command-line-tools) for install steps |
| **Apple Developer Program membership** ($99/year) | Required for code-signing apps + WDA for real devices. Free Apple ID is NOT sufficient. | Enroll at https://developer.apple.com/programs/ — approval can take 1-2 business days for individual accounts, up to a week for organization accounts |
| **Your Apple ID added to the Developer team** in App Store Connect | So Xcode can sign builds under your team's account | Ask your team's Developer Account admin to invite you |
| **Physical iPhone or iPad** running iOS 15+ | The test target | Must be unlocked and connected via USB or supported wireless (Xcode 15+) |
| **Lightning or USB-C cable that supports data transfer** | Charge-only cables won't expose the device to Xcode | Use an Apple-branded cable if possible — third-party cables sometimes have data issues |
| **Carthage** installed via Homebrew | WDA dependency builds | `brew install carthage` |
| **Appium 2.x + XCUITest driver** | Automation engine | Already covered if you followed the Simulator guide |

**Corporate Mac gotcha:** many corporate Macs are managed via MDM (Jamf, Kandji, Intune) and restrict Xcode version, Developer Account provisioning, or USB device access. Expect to file IT tickets for:
- Xcode install permission
- Adding your Apple ID to the corporate Apple Developer Program team
- USB debugging / device trust (if your MDM blocks USB device access)

---

## 1. Apple Developer Program Enrollment

**If your organization already has a Developer Account** with a Team ID, skip this section — ask your admin to invite you to the team and confirm you see it in Xcode's **Settings → Accounts**.

**If you're setting up from scratch:**

1. Go to https://developer.apple.com/programs/
2. Click **Enroll**
3. Sign in with your Apple ID (the same one you'll use in Xcode)
4. Pick **Individual** ($99/yr) or **Organization** ($299/yr + D-U-N-S number)
5. Complete the enrollment form and payment
6. Wait for approval — usually 1-2 business days for individual, 1+ week for organization (Apple verifies D-U-N-S)
7. When approved, go to https://developer.apple.com/account/ and verify you see **Certificates, Identifiers & Profiles**

### Add your Apple ID to Xcode

1. Open **Xcode → Settings → Accounts**
2. Click **+** in the bottom-left → **Apple ID**
3. Sign in with your Apple ID
4. Select the account → click **Manage Certificates** → verify you see a valid "Apple Development" certificate (create one if not)

---

## 2. Register Your Test Device in the Developer Portal

Apple limits you to **100 registered devices per product family (iPhone, iPad, etc.) per membership year**. Treat these slots carefully — you can only remove devices from the list once a year when you renew.

1. Connect your test device to the Mac via USB
2. Unlock the device and accept any "Trust this computer?" prompt on the device
3. Open **Xcode → Window → Devices and Simulators** (`Cmd+Shift+2`)
4. Under **Devices**, verify your device appears in the left sidebar. Click it.
5. Copy the **Identifier (UDID)** — it's a 25 or 40-character hex string
6. Go to https://developer.apple.com/account/resources/devices/list
7. Click **+** to add a new device
8. Give it a name (e.g., "QA Test Pixel 7") and paste the UDID
9. Click **Continue** → **Register**

**Device is now authorized** for development provisioning profiles from your team.

---

## 3. Prepare WebDriverAgent for Real-Device Code-Signing

This is the step most likely to bite you. WDA is a small iOS test-runner app that Appium uses to automate real devices. For Simulator testing, WDA is built unsigned — but for real devices, iOS requires WDA to be code-signed with your Developer Team's certificate and provisioning profile.

### Step 3a — Locate the WDA Xcode project

After you installed the Appium XCUITest driver (`appium driver install xcuitest`), WDA lives at:
```
~/.appium/node_modules/appium-xcuitest-driver/node_modules/appium-webdriveragent/WebDriverAgent.xcodeproj
```

### Step 3b — Bootstrap Carthage dependencies

```bash
cd ~/.appium/node_modules/appium-xcuitest-driver/node_modules/appium-webdriveragent
carthage bootstrap --platform iOS --use-xcframeworks
```

**On Apple Silicon Macs**, the `--use-xcframeworks` flag is usually required. If the Carthage build fails with "ld: symbol(s) not found for architecture arm64" or similar linker errors, try:
```bash
carthage bootstrap --platform iOS --use-xcframeworks --no-use-binaries
```

If it STILL fails with obscure Carthage errors, the community workaround is a known-good Carthage script:
```bash
# https://github.com/Carthage/Carthage/issues/3019 — look at the latest workaround script
curl -fsSL https://raw.githubusercontent.com/Carthage/Carthage/master/Scripts/install.sh | bash
```

**⚠️ This is where the maintainer notes end with high confidence.** Beyond this point, every project's WDA build experience is slightly different. The general path is correct; specific error messages you may hit require Google searching against the Appium XCUITest driver's GitHub issues.

### Step 3c — Open WDA in Xcode and configure signing

1. ```bash
   open ~/.appium/node_modules/appium-xcuitest-driver/node_modules/appium-webdriveragent/WebDriverAgent.xcodeproj
   ```
2. In Xcode, select the **WebDriverAgent** project in the left navigator
3. Select the **WebDriverAgentRunner** target (NOT WebDriverAgentLib)
4. Go to **Signing & Capabilities** tab
5. **Automatically manage signing:** ON
6. **Team:** pick your Apple Developer Team from the dropdown
7. Xcode may show an error like "Failed to register bundle identifier" — click **Try Again** or fix by changing the Bundle Identifier to something unique (prefix with your team's reverse-DNS, e.g., `com.yourteam.WebDriverAgentRunner`)
8. Repeat for the **IntegrationApp** target if it's present in your version of WDA
9. **Product → Build** (`Cmd+B`) — wait for the build to succeed once
10. If you see any signing errors, resolve them in the Signing & Capabilities tab and rebuild

### Step 3d — (Real device trust) Install WDA on the device the first time

After a successful Xcode build:
1. Select the **WebDriverAgentRunner** scheme in Xcode's toolbar
2. Pick your physical device as the destination (also in the toolbar)
3. **Product → Test** (`Cmd+U`) — this builds and installs WDA on the device
4. On the device, you'll get a dialog "Untrusted Developer" — accept it
5. Go to **Settings → General → VPN & Device Management** on the device → find your Developer Team → **Trust**
6. Now you can retry the test run; WDA will launch and Xcode will show it as running

**This whole Xcode WDA setup is a one-time step per device.** Once WDA is signed and trusted, Appium sessions can launch it automatically on subsequent runs.

---

## 4. Connect the Device + Verify

```bash
# Confirm Xcode sees the device
xcrun xctrace list devices
# Example output:
#   == Devices ==
#   MacBook Pro (00006000-001234567890ABCD)
#   == Devices Offline ==
#   == Simulators ==
# ...
#   iPhone 15 (00008120-0012345ABCDEF001) (17.1)

# Note the iPhone's UDID (the hex string after the name)
```

The UDID from `xcrun xctrace list devices` is what you'll put in `IOS_UDID` in `.env`.

---

## 5. Install the App Under Test on the Device

Pick one of:

### Pattern A — Install via Xcode

1. Open your app's Xcode project
2. Pick the physical device as the destination
3. **Product → Run** (`Cmd+R`) — Xcode builds, signs, installs, and launches the app

Note the app's **Bundle Identifier** from the target's General tab.

### Pattern B — Install a signed `.ipa` via `ideviceinstaller` (requires Xcode + libimobiledevice)

```bash
brew install libimobiledevice ideviceinstaller
ideviceinstaller --install /path/to/YourApp.ipa --udid <device-udid>
```

### Pattern C — Install via `APP_PATH` (Appium installs at session start)

Set `IOS_APP_PATH` in `.env` — Appium handles installation. **Note:** the `.ipa` must already be signed with a provisioning profile that includes your test device's UDID. You cannot install an unsigned `.ipa` on a real device — that's an Apple security boundary.

---

## 6. Configure `output/.env`

```env
# --- Mobile (Appium) ---
PLATFORM=ios
APPIUM_HOST=localhost
APPIUM_PORT=4723
NO_RESET=true

# --- iOS real device ---
IOS_DEVICE=iPhone 15                                # Device model name (for readability)
IOS_UDID=00008120-0012345ABCDEF001                  # REQUIRED for real devices — UDID from `xcrun xctrace list devices`
IOS_VERSION=17.1

# --- App under test ---
IOS_BUNDLE_ID=com.example.yourapp
# OR install .ipa fresh each session:
# IOS_APP_PATH=/absolute/path/to/YourApp.ipa

# --- WDA signing (for real device, if Appium needs to auto-rebuild WDA) ---
# These capabilities may be required in output/core/capabilities.ts for real-device runs —
# they're NOT in the default capabilities today because the framework hasn't been real-device-verified on iOS.
# If WDA re-signing is required per session, you'll need to add:
#   'appium:xcodeOrgId': 'YOUR_APPLE_TEAM_ID'
#   'appium:xcodeSigningId': 'iPhone Developer'
#   'appium:updatedWDABundleId': 'com.yourteam.WebDriverAgentRunner'
# to iosCapabilities in output/core/capabilities.ts. Contributing this back to the
# templates/config-mobile/capabilities.ts template is welcome once you've verified it works.
```

---

## 7. Configure MCP Servers

Same as [ios-simulator.md § 7](ios-simulator.md#7-configure-mcp-servers-vs-code-copilot).

---

## 8. Start Appium + First Session

```bash
appium
```

The first session against a real device will attempt to launch WDA. **If you've already manually signed + installed WDA in step 3**, this should work. If not, Appium will try to auto-sign WDA using your Xcode credentials, which may or may not succeed depending on your Xcode version.

---

## 9. Expected Trouble Spots — Where First-Time Users Get Stuck

These are the known common failure modes for first-time iOS real-device setup. The fixes are known but require careful step-through.

| Symptom | Known-correct fix |
|---|---|
| **Appium fails to launch WDA: "Unable to launch WebDriverAgentRunner"** | WDA isn't signed for your device. Follow step 3 end-to-end. If already done, the provisioning profile may have expired — open the WDA Xcode project and rebuild. |
| **Appium can't find the device despite `xcrun xctrace` listing it** | `IOS_UDID` in `.env` is wrong or outdated. Re-copy the UDID from `xcrun xctrace list devices`. |
| **"Could not resolve: carthage: command not found"** during first WDA build | `brew install carthage` and retry. |
| **`carthage bootstrap` fails with "ld: symbol(s) not found for architecture arm64"** on Apple Silicon | Retry with `carthage bootstrap --platform iOS --use-xcframeworks`. If still failing, see Carthage's GitHub issue #3019 for the latest workaround. |
| **"No profiles for 'com.yourteam.WebDriverAgentRunner' were found"** when building WDA | In Xcode's Signing & Capabilities tab for the WebDriverAgentRunner target: change the Bundle Identifier to a unique string (prefix with your team's reverse-DNS), and make sure "Automatically manage signing" is ON. |
| **"The device is not paired"** error from libimobiledevice or Xcode | Unplug, replug, accept the "Trust this computer?" prompt on the device. If persistent, reset the device's trust settings: **Settings → General → Transfer or Reset iPhone → Reset → Reset Location & Privacy** (this clears the trust list). |
| **Test works once, then WDA disappears from the device** | iOS auto-deletes "unused" sideloaded apps after ~7 days for free-tier developer accounts. Paid Developer Program accounts don't have this limit — verify you're on a paid tier. |
| **`BaseScreen.selectOption()` fails on iOS** | This method is Android-only. See [ios-simulator.md § 12](ios-simulator.md#12-known-ios-gaps--basescreen-methods-that-are-android-only) for the workaround. |
| **Session starts but element lookups fail with "no such element"** | Element discovery may need iOS-specific predicates (`-ios predicate string:...`). Run the Explorer and let it capture per-platform locators — do not hand-translate Android locators. |

---

## 10. What's Known to Work vs Not Verified

| Component | Status |
|---|---|
| Appium 2.x + XCUITest driver on iOS Simulator | ✅ Known good (Apple + Appium official docs) |
| Framework's `iosCapabilities` in `output/core/capabilities.ts` | ✅ Structure is correct (compiles, matches Appium spec) |
| Framework's `MobileLocatorLoader` iOS strategy priority (`accessibility_id → id → class_chain → predicate_string → xpath`) | ✅ Code is correct |
| `BaseScreen.goBack()` / `goHome()` iOS branches | ✅ Use `mobile: pressButton` — documented in Appium XCUITest driver |
| `BaseScreen.selectOption()` on iOS | ❌ **Android-only** — uses `android=new UiSelector()` hardcoded |
| `BaseScreen.waitForActivity()` on iOS | ❌ **Android-only** — iOS has no Activities |
| WDA code-signing flow described in this guide | ⚠️ **Not device-verified** — based on Appium + Apple docs, should be correct but specific errors vary by Xcode version |
| `wdio.conf.ts` `beforeSuite` hook with `terminateApp` / `activateApp` on iOS | ⚠️ **Should work** — these are Appium's cross-platform commands, but not verified on real iOS device |
| Framework's parity verification specs on iOS | ❌ **All tagged `@android-only`** — no iOS parity specs exist yet |
| Flipkart / SpeedTest reference scenarios on iOS | ❌ **No iOS locator entries** — scenarios would fail until locator JSONs are extended |

---

## 11. How You Can Help

If you successfully run the framework on a real iOS device:

1. **Update this guide** — remove placeholders, add your actual walked-through steps, note which Xcode version you used
2. **Contribute a parity verification spec** for iOS — pick one of the framework's existing parity tests (e.g., `test-lifecycle-hooks`) and write an iOS-equivalent under `output/tests/mobile/parity/ios/`, tagged `@ios-only`
3. **Update `templates/core-mobile/base-screen.ts`** with iOS-specific replacements for `selectOption()` and `waitForActivity()`, wrapped in a platform check so Android behavior is preserved
4. **Update `templates/config-mobile/capabilities.ts`** if you found additional iOS capabilities that are required for real-device runs (e.g., `xcodeOrgId`, `updatedWDABundleId`)
5. **Write an `scenarios/app-contexts/{your-app}-ios.md`** with learned iOS-specific patterns (native permission dialogs, Share Sheet behavior, etc.)
6. **Open a PR** with all of the above. Tag it with `mobile-parity-ios-ga` label. Your PR is how iOS goes from "supported at the config level" to "Generally Available" for the next release.

---

## 12. Alternative: Use a Cloud Device Farm for iOS

If setting up a real iOS device is blocking you, **consider using a cloud device farm instead** — BrowserStack, Sauce Labs, LambdaTest, and AWS Device Farm all support iOS real devices without the WDA signing ceremony (the cloud provider handles code-signing server-side).

- For BrowserStack / Sauce Labs / LambdaTest → [cloud-farms.md](cloud-farms.md)
- For AWS Device Farm → [aws-device-farm.md](aws-device-farm.md)

Cloud farms are often the fastest path to first iOS test run — you skip Apple Developer enrollment, Carthage, WDA signing, and device trust entirely. The tradeoff is cost-per-session and some device-pool availability variance. For teams that have one local Android device and want iOS coverage without hardware investment, cloud farms are the pragmatic choice.

---

## 13. Summary — What You Should Have (Once Complete)

- Apple Developer Program membership (paid) with your Apple ID on a Team
- Test device UDID registered in the Developer portal
- Xcode + Command Line Tools + Carthage installed
- WebDriverAgentRunner signed and trusted on your physical device
- Appium 2.x + XCUITest driver installed
- `output/.env` with `IOS_UDID`, `IOS_BUNDLE_ID`, `PLATFORM=ios`
- A successful first Appium session that launches WDA on the device and captures the app's first screen
- Updated this guide with your actual steps and opened a PR to share fixes with the team

**Good luck — you're pioneering the iOS path for this framework.** Document everything, file issues for anything that's broken, and contribute your fixes. The next person will thank you.
