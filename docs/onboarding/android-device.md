# Onboarding — Real Android Device

This guide walks through setting up the Agentic QE Framework v2 to run mobile tests against a physical Android device connected via USB. By the end of this guide you'll have your device recognized by ADB, Appium connected to it, and a parity verification spec passing green.

**Target audience:** QE engineers with a company-provided Android test device or personal phone used for development.

**Estimated time:** 20-40 minutes.

**Assumption:** you have already completed the core framework setup from the [main README](../../README.md#setup) — `npm install`, `npm run setup`, VS Code with GitHub Copilot installed, Node 18+ and Java 17+ verified.

> **📘 Cross-platform note — Windows users:** this guide uses Unix-style shell syntax (`export FOO=bar`, `command &` backgrounding). The fastest path to follow it unchanged is to run the commands inside **WSL 2** (Windows Subsystem for Linux) or **Git Bash** (bundled with [Git for Windows](https://git-scm.com/download/win)). In both, every Unix example below works as-written. If you prefer **native PowerShell**, `adb` / `appium` / `npm` / `npx wdio` all work identically — only shell-level commands like `export` and `udev` rules are Unix-specific (udev is Linux-only and already scoped to its own subsection). **Note:** the "Linux udev permissions" subsection below only applies to Linux dev machines — Windows and macOS users can skip it.

**When to use this guide instead of [android-emulator.md](android-emulator.md):**
- Your team's release gates require real-device testing (emulators don't reproduce some hardware-dependent bugs)
- You're testing features that need real sensors: camera, GPS, biometrics, NFC, Bluetooth, cellular network
- You're testing battery / performance profiling
- You're verifying device-fragmentation bugs on specific OEM builds (Samsung One UI, Xiaomi MIUI, Pixel stock)
- You want to catch GBoard glide-typing injection bugs (these do NOT reproduce on emulators — emulators use a different IME)

**When to use the emulator guide instead:**
- Rapid iteration during development
- No physical device available
- Running in CI/CD without device lab hardware
- Team onboarding where every dev needs their own test target

---

## 0. Prerequisites — What You Need Before Starting

| Need | Why | Verify |
|---|---|---|
| **Physical Android device** | The target of the test runs | Running Android 10+ recommended — older versions have ADB quirks |
| **USB cable that supports data transfer** (not just charging) | Charge-only cables won't expose ADB | Look for a cable that came with the device, or a known-good data cable |
| **Android SDK platform-tools installed** (just `adb`, you don't need the full SDK or emulator) | `adb` is how your machine talks to the device | Already covered if you ran the emulator guide. Otherwise: install just platform-tools via `sdkmanager "platform-tools"` or `brew install android-platform-tools` (macOS) or `sudo apt install android-tools-adb` (Linux) |
| **Java JDK 17** | Appium UiAutomator2 requires it | `java --version` → `17.x` |
| **Node.js 18+** | Framework requires it | `node --version` |
| **OEM USB driver** (Windows only) | Windows needs a device-specific driver to recognize the device. macOS and Linux usually don't. | Search "<device model> USB driver" — Google Pixel uses Google USB Driver (bundled with Android Studio); Samsung uses Samsung USB Driver; etc. |
| **Appium 2.x + UiAutomator2 driver** | The automation engine | `appium --version` and `appium driver list --installed` |

If Appium and the Android SDK aren't yet installed, follow steps 1 and 2 of [android-emulator.md](android-emulator.md#1-install-the-android-sdk-and-emulator-tools) before continuing.

---

## 1. Enable Developer Options + USB Debugging on the Device

This is the main difference vs an emulator — a physical device won't talk to ADB until you explicitly enable USB debugging in the Android settings. It's a two-step unlock.

### Step 1 — Unlock Developer Options

1. Open **Settings** on the device
2. Go to **About phone** (location varies by OEM — sometimes under "System" or at the bottom of Settings)
3. Find **Build number** and **tap it 7 times**
4. After 3-4 taps you'll see a toast "You are now N steps away from being a developer" — keep tapping
5. On the 7th tap, a toast confirms: "You are now a developer!"
6. Go back to Settings → **System → Developer options** should now exist (may require searching Settings for "Developer options" on some OEMs)

### Step 2 — Enable USB Debugging

1. In **Settings → System → Developer options**
2. Toggle **USB debugging** ON
3. A dialog will warn you that USB debugging is meant for development only — confirm **OK**
4. While you're in Developer options, also enable **Stay awake** (keeps the screen on while charging — useful during test runs)

### Step 3 — Optional but Recommended for Testing

In Developer options, consider enabling these to make tests more reliable:
- **Window animation scale: Animation off** (reduces test flakiness from animation delays)
- **Transition animation scale: Animation off**
- **Animator duration scale: Animation off**
- **Don't keep activities: OFF** (leave default — some apps break when this is on)
- **Disable permission monitoring** (if available — stops Play Protect from killing Appium during tests)

**Corporate device gotcha:** some corporate MDM policies disable Developer options entirely or require admin approval. If you can't find Developer options after 7 taps on Build number, file an IT ticket citing "QA automation requires ADB debugging access."

---

## 2. Connect the Device via USB

1. Plug the device into your laptop with a data-capable USB cable
2. On the device, you should see a "USB debugging" dialog asking "Allow USB debugging from this computer?" — tap **Allow** (check "Always allow from this computer" if you want to skip this next time)
3. The device may prompt you to select USB mode — choose **File Transfer (MTP)** or **PTP**. Plain "Charging only" will not expose ADB.

**If no dialog appears on the device:**
- Unplug and replug the cable
- Try a different USB port (some corporate laptops have flaky USB-C Thunderbolt ports — try a USB-A port if available)
- Windows: make sure the OEM USB driver is installed (check Device Manager for "Unknown device" or yellow exclamation marks)

### Verify ADB sees the device

```bash
adb devices
```

Expected:
```
List of devices attached
R5CT123ABCDEF    device
```

The long hex string is the device serial — note it down, you'll use it as `ANDROID_DEVICE` in `.env` next.

**Possible states:**
| State | Meaning | Fix |
|---|---|---|
| `device` | Healthy connection, ready to automate | Continue to step 3 |
| `unauthorized` | You haven't tapped "Allow" on the device's USB debugging dialog | Unlock the device, accept the dialog. If no dialog appears, toggle USB debugging off and on again in Developer options. |
| `offline` | ADB connection got into a bad state | `adb kill-server && adb start-server && adb devices` |
| `no permissions` (Linux) | Your user doesn't have USB permissions for the device | See Linux udev section below |
| (not listed at all) | Wrong USB mode, bad cable, or missing OEM driver | Unplug, try another cable, try another port, install OEM driver (Windows) |

### Linux udev permissions

On Linux, non-root users can't access USB devices by default. You'll see `no permissions` from `adb devices` until you set up udev rules:

```bash
# Find your device's vendor ID (the four hex chars before :)
lsusb | grep -i android   # or search for your device's OEM name

# Example output:
#   Bus 001 Device 012: ID 18d1:4ee7 Google Inc. Nexus/Pixel Device (MTP)
# Vendor ID here is 18d1 (Google)

# Add a udev rule for your vendor
sudo nano /etc/udev/rules.d/51-android.rules
# Paste (replace 18d1 with your vendor ID):
SUBSYSTEM=="usb", ATTR{idVendor}=="18d1", MODE="0666", GROUP="plugdev"

# Reload udev
sudo udevadm control --reload-rules
sudo udevadm trigger

# Unplug and replug the device
adb devices
```

Common Android vendor IDs: Google = `18d1`, Samsung = `04e8`, Xiaomi = `2717`, OnePlus = `2a70`, Motorola = `22b8`.

---

## 3. Install the App Under Test on the Device

Same three patterns as the emulator guide. The only difference is the device serial (from `adb devices`) instead of `emulator-5554`.

### Pattern A — Install once via ADB, attach by package

```bash
# Install the APK on the device
adb -s R5CT123ABCDEF install /path/to/your-app.apk

# Extract package + main activity from the APK
aapt dump badging /path/to/your-app.apk | grep -E "package|launchable-activity"
```

Note the package name and launchable-activity name for the `.env` step below.

### Pattern B — Install fresh APK each session via `APP_PATH`

Just set `APP_PATH` in `.env` (next step). Appium will install the APK at the start of every session. Adds ~15-30s per session on a real device (USB transfer + install time is longer than emulator).

### Pattern C — App already installed (e.g., from Play Store)

Find the package name:
```bash
adb -s R5CT123ABCDEF shell pm list packages | grep -i <app-keyword>
adb -s R5CT123ABCDEF shell cmd package resolve-activity --brief com.example.myapp | tail -1
```

---

## 4. Configure `output/.env`

```bash
cd output
cp .env.example .env          # if .env doesn't exist yet
```

Edit `output/.env`:

```env
# --- Mobile (Appium) ---
PLATFORM=android
APPIUM_HOST=localhost
APPIUM_PORT=4723
ANDROID_DEVICE=R5CT123ABCDEF       # YOUR device serial from `adb devices`
NO_RESET=true                      # attach to pre-installed app (fast iteration). Set to false for fresh install per session.

# --- App under test ---

# Pattern A or C — pre-installed app
APP_PACKAGE=com.example.myapp
APP_ACTIVITY=com.example.myapp.MainActivity

# Pattern B — uncomment instead of APP_PACKAGE/APP_ACTIVITY
# APP_PATH=/absolute/path/to/your-app.apk
```

### Verify your config before running tests

```bash
adb -s R5CT123ABCDEF shell am start -n com.example.myapp/com.example.myapp.MainActivity
```

If this launches the app on your physical device, the `.env` values are correct.

---

## 5. Configure MCP Servers (VS Code Copilot)

Identical to the emulator guide — see [android-emulator.md § 6](android-emulator.md#6-configure-mcp-servers-vs-code-copilot) for the MCP config. The framework doesn't distinguish between emulator and real device at the MCP layer — Appium abstracts that away.

After editing `.vscode/mcp.json`, **reload the VS Code window** (`Ctrl+Shift+P` → **Developer: Reload Window**).

---

## 6. Start Appium

```bash
appium
```

Leave running in a separate terminal. Verify:
```bash
curl http://localhost:4723/status
```
Should return JSON with `"ready": true`.

---

## 7. Smoke Test — Run a Parity Verification Spec

Install SpeedTest on your device (via Play Store or `adb install`) to use as a known-good smoke test app:
```bash
adb -s R5CT123ABCDEF install ~/Downloads/SpeedTest.apk
```

Temporarily point `.env` at SpeedTest:
```env
APP_PACKAGE=org.zwanoo.android.speedtest
APP_ACTIVITY=com.ookla.mobile4.screens.main.MainActivity
```

Run the lifecycle hooks verification:
```bash
cd output
PLATFORM=android npx wdio run wdio.conf.ts \
  --spec tests/mobile/parity/test-lifecycle-hooks.spec.ts \
  --mochaOpts.grep "@android-only|@cross-platform"
```

Expected: 2 tests pass in 15-30 seconds on a real device (slightly slower than an emulator due to USB overhead + real device animations).

If this passes, revert `.env` to your real app and continue to step 8.

---

## 8. Write and Run Your First Real Scenario

Identical workflow to the emulator guide — see [android-emulator.md § 9](android-emulator.md#9-write-and-run-your-first-real-scenario) for the full Explorer → Builder → Executor → Reviewer flow.

The only difference: your tests run on a physical device instead of an emulator, which means:
- **Watch the device screen** while the Explorer runs — you can see exactly what it's doing
- **Real-device timing is slightly slower** than emulators — expect each interaction to take 100-300ms vs 50-150ms on an emulator
- **Real-device bugs surface** that emulators don't catch: GBoard glide typing, keyboard animation timing, thermal throttling under load

---

## 9. Real-Device-Specific Troubleshooting

These issues are specific to physical devices and don't occur on emulators.

| Symptom | Root cause | Fix |
|---|---|---|
| `adb devices` shows the device as `unauthorized` | You didn't accept the "Allow USB debugging" dialog on the device | Unlock device, accept dialog. If no dialog appears, toggle USB debugging off/on in Developer options |
| Device disconnects mid-test | USB cable flaky, OR USB port power-saving | Try a different cable (ideally the one that came with the device). On Windows, disable USB selective suspend in Power Options |
| Tests work on your laptop, fail on a colleague's | Their device has a different OEM / OS version / language | This is fragmentation — file per-device patterns to `scenarios/app-contexts/{app}-android.md` so the framework learns |
| `no permissions` on Linux | udev rules not set up for your device vendor | See Linux udev section in step 2 |
| Test types "by by by" into the search field during a swipe | GBoard glide-typing injection — **specific to real devices with GBoard installed** | Use `BaseScreen.typeText()` / `pressSequentially()` (they auto-dismiss keyboard). Or manually: `await driver.hideKeyboard()` before the swipe. |
| Device locks/sleeps mid-test, tests start failing | Auto-lock timeout too short | Enable **Developer options → Stay awake (while charging)** — the device stays on as long as USB is connected |
| Device battery drains during test runs | Normal — test runs keep the display on | Plug in during test sessions; "Stay awake" above assumes charging |
| First tap/click is ignored by the app | Real device screen isn't awake when Appium connects | Add `await driver.executeScript('mobile: wakeUp', [])` at the start of the test, or set capability `appium:unlockType=noLock` |
| `appium:unlockType=noLock` not enough — device has a screen lock PIN | Device is encrypted and requires unlock | Use `appium:unlockKey=<PIN>` capability, OR disable screen lock in device settings for test devices |
| Tests intermittently fail with "session timed out" during long runs | Device thermal throttling or OS killed Appium's listener | Keep device cool (no direct sunlight), plug into a powered USB hub if USB bus is crowded, increase Appium's `newCommandTimeout` in `output/core/capabilities.ts` |
| Device runs out of storage after many test runs | APK reinstalls + cached test data accumulating | Periodically `adb uninstall com.example.myapp && adb install` or clear app data: `adb shell pm clear com.example.myapp` |
| Play Protect repeatedly blocks the APK install | Google Play Protect flags unsigned/debug APKs | Disable Play Protect for test devices: **Play Store → profile icon → Play Protect → Settings → Scan apps with Play Protect (OFF)** |

---

## 10. Maintenance — Keeping Real Devices Healthy for Testing

Real-device testing adds some upkeep that emulators don't need:

- **Charge between sessions** — tests drain battery fast. Keep devices plugged in.
- **Clear cached app data** periodically to avoid running out of storage: `adb shell pm clear com.example.myapp`
- **Reboot the device** once a week — Android OS state drifts over long periods
- **Keep the OS stable** — do NOT auto-install OS updates on test devices without retesting. Lock the device to a specific Android version for reproducibility.
- **Disable auto-updates on the app under test** — Play Store will otherwise update your app out from under your tests. Turn off auto-update: **Play Store → profile → Settings → Network preferences → Auto-update apps → Don't auto-update**
- **Lock the timezone and language** — tests that depend on date/time formatting break when the device auto-adjusts on travel or locale changes

---

## What You Have Now

- A physical Android device recognized by ADB as `device` status
- Appium server running on localhost:4723
- `.vscode/mcp.json` configured with Appium MCP, VS Code reloaded
- `output/.env` pointing at your device serial + your app
- A passing parity verification spec against the real device
- At least one real scenario of your own authored and running

**Next:** read [Mobile Test Automation](../../README.md#mobile-test-automation) for deeper material, and review the [Mobile Failure Signatures](../../README.md#mobile-failure-signatures) table — most of those symptoms are specific to real devices (GBoard glide typing, keyboard blocking, thermal throttling).
