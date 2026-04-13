# Onboarding — Android Emulator

This guide walks a new team member through setting up the Agentic QE Framework v2 to run mobile tests against an Android emulator on their dev machine. By the end of this guide you should have a running emulator that ADB sees, an Appium server connected to it, and the framework's parity verification specs passing green.

**Target audience:** developers / QE engineers on a corporate laptop, no prior Android SDK experience required.

**Estimated time:** 30-60 minutes (mostly waiting on Android Studio + SDK downloads).

**Assumption:** you have already completed the core framework setup from the [main README](../../README.md#setup) — `npm install`, `npm run setup`, VS Code with GitHub Copilot installed, Node 18+ and Java 17+ verified.

> **📘 Cross-platform note — Windows users:** this guide uses Unix-style shell syntax (`export FOO=bar`, `cat > file << EOF` heredocs, `command &` backgrounding). The fastest path to follow it unchanged is to run the commands inside **WSL 2** (Windows Subsystem for Linux) or **Git Bash** (bundled with [Git for Windows](https://git-scm.com/download/win)). In both, every Unix example below works as-written. If you prefer **native PowerShell**, the critical commands that need translation are called out inline with `# PowerShell equivalent:` comments. Framework commands (`npm`, `npx wdio`, `adb`, `appium`) work identically in PowerShell with no changes. macOS and Linux users run everything natively.

---

## 0. Prerequisites — What You Need Before Starting

| Need | Why | Verify |
|---|---|---|
| **Local admin rights** (or user-home install allowed) | Android SDK installs to `~/Android/Sdk` on Linux/macOS or `%LOCALAPPDATA%\Android\Sdk` on Windows | `whoami /priv` (Windows) or `id` (macOS/Linux) |
| **Node.js 18+** | Framework requires it | `node --version` → `v18.x.x` or higher |
| **Java JDK 17** | Appium's UiAutomator2 driver requires Java 17 — older Java 8/11 silently breaks in subtle ways | `java --version` → must print `17.x` |
| **Hardware virtualization enabled in BIOS** (Intel/AMD) or **Apple Silicon Mac** | Emulator needs hardware acceleration. Without it, tests take 5-10× longer and are barely usable | Intel CPUs: check BIOS for VT-x / AMD-V. Apple Silicon: automatic. Intel Macs: install HAXM via Android Studio SDK Manager. |
| **Corporate proxy settings documented** | npm install, Appium driver downloads, MCP server startup all go through the proxy | Ask IT for `HTTP_PROXY`, `HTTPS_PROXY`, `NO_PROXY` values |
| **Firewall exception for `localhost:4723` (Appium) and `5554-5585` (ADB/emulator)** | Some corporate firewalls block loopback traffic on non-standard ports | After Appium starts, run `curl http://localhost:4723/status` — if blocked, request an exception |

**Corporate machine gotcha:** many enterprise firewalls block downloading Android system images. If your `sdkmanager` downloads fail with SSL or connection errors, configure the proxy:
```bash
# macOS/Linux
export HTTP_PROXY=http://proxy.corp.example.com:8080
export HTTPS_PROXY=http://proxy.corp.example.com:8080

# Windows PowerShell
$env:HTTP_PROXY = "http://proxy.corp.example.com:8080"
$env:HTTPS_PROXY = "http://proxy.corp.example.com:8080"
```

---

## 1. Install the Android SDK and Emulator Tools

You have two install options. **Recommended for first-time users:** Android Studio. It gives you a GUI (AVD Manager, SDK Manager, device list) that makes diagnosing problems much easier than CLI-only.

### Option A — Android Studio (recommended)

1. Download Android Studio from https://developer.android.com/studio
2. Run the installer. Accept defaults. It will download ~1-2 GB of SDK components on first launch — this is the slowest part, budget 15-30 minutes on a corporate connection.
3. After first launch, go to **Settings → Languages & Frameworks → Android SDK**:
   - Under **SDK Platforms**, tick **Android 14.0 (API 34)** — this is the current mainstream version
   - Under **SDK Tools**, tick **Android SDK Platform-Tools**, **Android Emulator**, and (Intel only) **Intel x86 Emulator Accelerator (HAXM installer)**
   - Click **Apply** → accept licenses → wait for download
4. Note the SDK install path at the top of the same dialog (e.g., `/Users/you/Library/Android/sdk` on macOS, `C:\Users\you\AppData\Local\Android\Sdk` on Windows)

### Option B — Standalone `cmdline-tools` (lighter, CLI-only)

Useful if Android Studio is blocked by IT or you prefer a minimal install:
```bash
# Download from https://developer.android.com/studio#command-line-tools-only
# Extract to $HOME/Android/Sdk/cmdline-tools/latest
mkdir -p $HOME/Android/Sdk/cmdline-tools/latest
# (move extracted contents into that directory)

export ANDROID_HOME=$HOME/Android/Sdk
export PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator

# Install the same components Android Studio would install
yes | sdkmanager --licenses
sdkmanager "platform-tools" "emulator" "platforms;android-34" "system-images;android-34;google_apis_playstore;x86_64"
```

(On Apple Silicon, replace `x86_64` with `arm64-v8a`.)

### Set `ANDROID_HOME` and PATH

**This is mandatory.** The framework's `capabilities.ts`, Appium, and the Appium MCP server all read `ANDROID_HOME` to find the SDK.

**macOS/Linux — add to `~/.zshrc` or `~/.bashrc`:**
```bash
export ANDROID_HOME=$HOME/Library/Android/sdk    # macOS default (Android Studio)
# export ANDROID_HOME=$HOME/Android/Sdk          # Linux default (standalone)
export PATH=$PATH:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$ANDROID_HOME/cmdline-tools/latest/bin
```
Then reload: `source ~/.zshrc` (or close and reopen your terminal).

**Windows — set via System Environment Variables:**
- `ANDROID_HOME` = `C:\Users\<you>\AppData\Local\Android\Sdk`
- Add to PATH:
  - `%ANDROID_HOME%\platform-tools`
  - `%ANDROID_HOME%\emulator`
  - `%ANDROID_HOME%\cmdline-tools\latest\bin`

After setting these, **close and reopen all terminals and VS Code** so the new PATH is picked up.

### Verify

```bash
adb --version           # should print "Android Debug Bridge version 1.0.x"
emulator -version       # should print a version number
sdkmanager --version    # should print a version number
echo $ANDROID_HOME      # should print your SDK root path
```

If any of these fail, revisit the PATH setup. Common cause: the PATH updates didn't apply to the current shell — close and reopen.

---

## 2. Install Appium 2.x + UiAutomator2 Driver

```bash
# Global install (requires admin on Windows, or sudo on macOS/Linux, or a user-local npm prefix)
npm install -g appium
appium driver install uiautomator2

# Verify
appium --version                      # should print 2.x
appium driver list --installed        # should show uiautomator2
```

**Corporate gotcha — `EACCES` or permission errors:** Either use `sudo npm install -g appium` (if your security policy allows) OR configure a user-local npm prefix:
```bash
mkdir -p ~/.npm-global
npm config set prefix ~/.npm-global
# Add ~/.npm-global/bin to PATH (same place you set ANDROID_HOME)
npm install -g appium
appium driver install uiautomator2
```

**Corporate gotcha — proxy errors downloading the driver:** `appium driver install` downloads from GitHub releases. If your network blocks it, set `HTTP_PROXY` / `HTTPS_PROXY` env vars before running the install command.

---

## 3. Create and Start an Android Emulator

An Android emulator is configured through the AVD (Android Virtual Device) Manager. Don't get hung up on the terminology — "creating an AVD" means "creating an emulator configuration," and the emulator binary reads that configuration when you start it.

### Option A — Android Studio GUI (recommended first time)

1. Open Android Studio
2. **Tools → Device Manager** (or click the Device Manager icon in the toolbar)
3. Click **Create Device**
4. Pick **Pixel 8** (or another phone model — Pixel devices have the best Appium compatibility)
5. Click **Next**, pick the **API 34 / Android 14** system image (download it if prompted — another 1-2 GB)
6. Click **Next**, name the AVD (e.g., `Pixel_8_API_34`), click **Finish**
7. In the Device Manager, click the **▶ Play** button next to the new AVD to start it
8. Wait 30-60 seconds for the emulator window to boot to the Android home screen

### Option B — Command line

```bash
# List available system images
sdkmanager --list | grep system-images

# Download the one you want (API 34 with Google Play Store — needed if you'll install apps from Play)
sdkmanager "system-images;android-34;google_apis_playstore;x86_64"    # Intel/AMD
# sdkmanager "system-images;android-34;google_apis_playstore;arm64-v8a"  # Apple Silicon

# Create the AVD
echo "no" | avdmanager create avd --name "Pixel_8_API_34" \
  --package "system-images;android-34;google_apis_playstore;x86_64" \
  --device "pixel_8"

# Start the emulator
emulator -avd Pixel_8_API_34 &     # macOS/Linux — runs in background
# Windows PowerShell:
# Start-Process emulator -ArgumentList "-avd", "Pixel_8_API_34"
```

Wait 30-60 seconds for the emulator window to fully boot (watch for the lock screen).

### Verify ADB sees the emulator

```bash
adb devices
```

Expected output:
```
List of devices attached
emulator-5554   device
```

**Possible states** — if you see something other than `device`:
- `offline` → `adb kill-server && adb start-server && adb devices`
- Not listed at all → Emulator didn't finish booting, or antivirus is blocking `adb.exe`. Check the emulator window — if stuck at "Android" text, give it another minute. If persistent, whitelist `platform-tools/` in your antivirus.

---

## 4. Install the App Under Test

Pick one of these three patterns depending on where your app's APK lives:

### Pattern A — Pre-installed, attach by package name (fastest iteration)

Install the APK once via ADB, then let Appium attach to it on each session start:
```bash
adb -s emulator-5554 install /path/to/your-app.apk

# Extract the package name + main activity from the APK (one-time lookup)
aapt dump badging /path/to/your-app.apk | grep -E "package|launchable-activity"
# Output example:
#   package: name='com.example.myapp' versionCode='42' ...
#   launchable-activity: name='com.example.myapp.MainActivity' ...
```

Note down `com.example.myapp` and `com.example.myapp.MainActivity` — you'll put them in `.env` next.

### Pattern B — Install fresh APK each session via `APP_PATH`

No pre-install step. Appium installs the APK at the start of every test session. Slower (adds ~15s per session for reinstall) but guarantees a clean state — useful when your tests need to verify first-launch behavior.

You don't need to run `adb install` — just set `APP_PATH` in `.env` (see next step).

### Pattern C — Install from Google Play Store inside the emulator

Requires a Google Play Store image (the one you downloaded if you picked `google_apis_playstore` in step 3). Open the emulator, sign in with a test Google account, install the app normally, then find the package:
```bash
adb -s emulator-5554 shell pm list packages | grep -i <app-keyword>
adb -s emulator-5554 shell cmd package resolve-activity --brief com.example.myapp | tail -1
```

---

## 5. Configure `output/.env`

```bash
cd output
cp .env.example .env              # creates starter .env from the committed example
```

Open `output/.env` in your editor and add these lines at the bottom (adjust values for your app):

```env
# --- Mobile (Appium) ---
PLATFORM=android
APPIUM_HOST=localhost
APPIUM_PORT=4723
ANDROID_DEVICE=emulator-5554       # from `adb devices`
NO_RESET=true                      # true = attach to pre-installed app (fast), false = fresh install each session

# --- App under test ---

# Pattern A or C — pre-installed app
APP_PACKAGE=com.example.myapp
APP_ACTIVITY=com.example.myapp.MainActivity

# Pattern B — uncomment and set APP_PATH instead of APP_PACKAGE/APP_ACTIVITY
# APP_PATH=/absolute/path/to/your-app.apk
```

### Verify your config before running tests

```bash
# Manually launch your app from the command line using the env values
adb -s emulator-5554 shell am start -n com.example.myapp/com.example.myapp.MainActivity
```

If this command launches your app on the emulator, your `APP_PACKAGE` and `APP_ACTIVITY` are correct. If it fails with `Activity not found`, double-check the activity name — it's case-sensitive and often includes a nested class path.

---

## 6. Configure MCP Servers (VS Code Copilot)

The framework's Explorer agent uses Appium MCP to interact with the emulator live during scenario exploration.

```bash
# Copy the sanitized template to your local (gitignored) config
cp .vscode/mcp.example.json .vscode/mcp.json
```

Open `.vscode/mcp.json`. The default content should work out of the box:

```json
{
  "servers": {
    "playwright": {
      "command": "npx",
      "args": ["@playwright/mcp@latest", "--isolated", "--browser", "chromium"]
    },
    "appium-mcp": {
      "command": "npx",
      "args": ["-y", "appium-mcp@latest"],
      "env": { "ANDROID_HOME": "${env:ANDROID_HOME}" }
    }
  }
}
```

**If you use nvm, fnm, or volta to manage Node,** bare `npx` may not resolve when VS Code's MCP host spawns the server (VS Code's environment doesn't always inherit your shell's PATH). In that case, replace `"command": "npx"` with the absolute path from `which npx` (macOS/Linux) or `where npx` (Windows), and add a PATH entry to the server's `env` block:

```json
{
  "servers": {
    "appium-mcp": {
      "command": "/Users/you/.nvm/versions/node/v20.11.0/bin/npx",
      "args": ["-y", "appium-mcp@latest"],
      "env": {
        "ANDROID_HOME": "${env:ANDROID_HOME}",
        "PATH": "/Users/you/.nvm/versions/node/v20.11.0/bin:${env:PATH}"
      }
    }
  }
}
```

**After saving `.vscode/mcp.json`:** reload the VS Code window (`Ctrl+Shift+P` → **Developer: Reload Window**). Both MCP servers start automatically.

**Verify MCP is running:** open Copilot chat and type `@QE Explorer`. If Copilot autocompletes the agent name, MCP is up. If it says "MCP tools not available," check **View → Output → MCP** for the actual error — almost always a PATH or ANDROID_HOME issue.

---

## 7. Start Appium (in a separate terminal, leave running)

```bash
appium
```

Appium prints a banner and waits for connections on `http://localhost:4723`. Leave this terminal open for the rest of your session.

**Verify Appium is reachable:**
```bash
curl http://localhost:4723/status
```
You should get a JSON response with `"ready": true`. If `curl` fails with "connection refused," Appium isn't running. If it fails with "connection timed out," a corporate firewall is blocking loopback traffic on port 4723 — request an exception.

---

## 8. Smoke Test — Run a Parity Verification Spec

Before writing your own scenarios, verify the whole stack works with a known-good framework test. The SpeedTest parity verification is the simplest — it only needs a running Appium session and a launching app.

**For this smoke test only**, temporarily point `.env` at SpeedTest (install from Play Store in the emulator first):
```env
APP_PACKAGE=org.zwanoo.android.speedtest
APP_ACTIVITY=com.ookla.mobile4.screens.main.MainActivity
```

Then run:
```bash
cd output
PLATFORM=android npx wdio run wdio.conf.ts \
  --spec tests/mobile/parity/test-lifecycle-hooks.spec.ts \
  --mochaOpts.grep "@android-only|@cross-platform"
```

**Expected:** 2 tests pass in 15-25 seconds.
```
Framework parity — mobile lifecycle hooks @parity @P0
  ✓ Scenario 1 — first test exercises the hooks @parity @P0
  ✓ Scenario 2 — second test confirms beforeEach/afterEach run between tests @parity @P0
2 passing (XXs)
```

**If this passes:** your whole stack is healthy. Revert `.env` to your real app and move on to step 9.

**If it fails:** jump to the Troubleshooting section at the end of this guide.

---

## 9. Write and Run Your First Real Scenario

### Create the scenario file

**Bash / zsh / Git Bash / WSL 2:**
```bash
mkdir -p scenarios/mobile/my-app
cat > scenarios/mobile/my-app/login-flow.md << 'EOF'
# Scenario: My App — Login Flow

## Metadata
- **Module:** Authentication
- **Priority:** P0
- **Type:** mobile
- **Platform:** android
- **Tags:** mobile, smoke, login, P0

## Application
- **App Package (Android):** {{ENV.APP_PACKAGE}}
- **App Activity (Android):** {{ENV.APP_ACTIVITY}}
- **Device:** {{ENV.ANDROID_DEVICE}}

## Pre-conditions
- App installed on the emulator
- Test user credentials available in `.env` as TEST_USERNAME / TEST_PASSWORD

## Steps
1. Launch the app
2. Tap the "Login" button
3. Type {{ENV.TEST_USERNAME}} in the email field
4. Type {{ENV.TEST_PASSWORD}} in the password field
5. Tap the "Sign In" button
6. VERIFY: Dashboard screen is displayed
7. SCREENSHOT: login-success
EOF
```

**PowerShell equivalent** (using here-string + `Set-Content`):
```powershell
New-Item -ItemType Directory -Force -Path scenarios/mobile/my-app | Out-Null
@'
# Scenario: My App — Login Flow

## Metadata
- **Module:** Authentication
- **Priority:** P0
- **Type:** mobile
- **Platform:** android
- **Tags:** mobile, smoke, login, P0

## Application
- **App Package (Android):** {{ENV.APP_PACKAGE}}
- **App Activity (Android):** {{ENV.APP_ACTIVITY}}
- **Device:** {{ENV.ANDROID_DEVICE}}

## Pre-conditions
- App installed on the emulator
- Test user credentials available in `.env` as TEST_USERNAME / TEST_PASSWORD

## Steps
1. Launch the app
2. Tap the "Login" button
3. Type {{ENV.TEST_USERNAME}} in the email field
4. Type {{ENV.TEST_PASSWORD}} in the password field
5. Tap the "Sign In" button
6. VERIFY: Dashboard screen is displayed
7. SCREENSHOT: login-success
'@ | Set-Content -Path scenarios/mobile/my-app/login-flow.md -Encoding UTF8
```

Or simply create the file in VS Code, paste the scenario content, and save — no shell commands needed.

### Run the Explorer (VS Code Copilot chat, fresh session)

```
@QE Explorer Run Explorer for scenario login-flow, type mobile, folder my-app.
Input: scenarios/mobile/my-app/login-flow.md
```

The Explorer connects to the emulator via Appium MCP, walks each step, captures element selectors from the page source, and writes `scenarios/mobile/my-app/login-flow.enriched.md` with `<!-- ELEMENT: ... -->` annotations.

### Run the Builder (new Copilot chat — fresh session per agent)

```
@QE Builder Run Builder for scenario login-flow, type mobile, folder my-app.
Input: scenarios/mobile/my-app/login-flow.enriched.md
```

The Builder produces:
- `output/locators/mobile/{screen-name}.locators.json` — platform-keyed
- `output/screens/{ScreenName}Screen.ts` — extends `BaseScreen`
- `output/tests/mobile/my-app/login-flow.spec.ts` — with `@android-only` tag in the `describe` title

### Run the test

```bash
cd output
PLATFORM=android npx wdio run wdio.conf.ts \
  --spec tests/mobile/my-app/login-flow.spec.ts \
  --mochaOpts.grep "@android-only|@cross-platform"
```

### If the test fails — run the Executor

```
@QE Executor Run Executor for scenario login-flow, type mobile, folder my-app.
```

The Executor fixes timing/selector issues up to 3 cycles.

### After the test passes — run the Reviewer

```
@QE Reviewer Review scenario login-flow, type mobile, folder my-app.
```

Produces a quality scorecard at `output/reports/my-app/review-scorecard-login-flow.md`. If the verdict is `NEEDS FIXES`, run `@QE Healer` next.

---

## 10. Troubleshooting

| Symptom | Root cause | Fix |
|---|---|---|
| `emulator -avd` exits immediately with "x86 emulation currently requires hardware acceleration" | VT-x disabled in BIOS (Intel) or HAXM not installed (Intel Mac) | Enable VT-x in BIOS (IT ticket), or install HAXM via Android Studio SDK Manager → SDK Tools |
| Emulator boots but `adb devices` shows nothing | ADB server not started, or antivirus blocking `adb.exe` | `adb kill-server && adb start-server && adb devices`. If persistent, whitelist `platform-tools/` in antivirus |
| `adb devices` shows `offline` | Device handshake incomplete | Restart ADB: `adb kill-server && adb start-server`. Cold-boot the emulator from Android Studio Device Manager (not just a restart — cold boot). |
| Emulator takes 5+ minutes to boot | First boot always slow — system image is cold-starting | Normal on first boot. Subsequent boots with Quick Boot snapshot are under 30s. |
| Appium starts but `curl http://localhost:4723/status` times out | Corporate firewall blocking loopback on port 4723 | Request firewall exception for loopback on port 4723. Confirm with IT. |
| VS Code Copilot says "Appium MCP tools not available" | MCP server failed to start — usually `ANDROID_HOME` not exported to VS Code's process | Set `ANDROID_HOME` at the OS level (not just in terminal), then fully restart VS Code (not just reload window). On macOS use `launchctl setenv ANDROID_HOME "$HOME/Library/Android/sdk"`. On Windows, System Environment Variables. |
| Explorer finds app but can't see any elements | Appium UiAutomator2 waiting for "app idle" — common on React Native apps | The framework's `wdio.conf.ts` `before()` hook applies `waitForIdleTimeout: 0` — verify the hook is intact. If you customized `wdio.conf.ts`, re-run `npm run setup` to restore the template. |
| Tests pass on first run, fail on second run with "element not found" | Stale navigation state between specs | The framework's `wdio.conf.ts` `beforeSuite` hook calls `terminateApp + activateApp` before every spec to reset state. Verify it's present. If you removed it, re-run `npm run setup`. |
| `java --version` prints Java 8 or 11 instead of 17 | System Java on PATH before JDK 17 | Update PATH so JDK 17's `bin/` comes before system Java, OR set `JAVA_HOME=/path/to/jdk-17` in your shell profile |
| `npm install -g appium` fails with proxy errors | Corporate proxy not configured for npm | `npm config set proxy http://proxy:8080 && npm config set https-proxy http://proxy:8080` |
| Tests hit "by by by" text injection during scrolling | GBoard glide typing when keyboard is visible during swipe — specifically an Android issue | Use `BaseScreen.typeText()` / `pressSequentially()` which auto-dismiss the keyboard. Or add explicit `await driver.hideKeyboard()` before the swipe. |
| Emulator works but tests are extremely slow | Hardware acceleration not actually active (falling back to software emulation) | Intel: verify VT-x enabled in BIOS and HAXM installed. Intel Mac: HAXM via SDK Manager. Apple Silicon: should be automatic — if slow, check that you're running an arm64-v8a system image (x86_64 images run under emulation on Apple Silicon and are 5-10× slower) |

---

## What You Have Now

At this point you should have:
- Android Studio (or standalone cmdline-tools) installed with API 34 and emulator tools
- `ANDROID_HOME` set and `adb` / `emulator` / `sdkmanager` on PATH
- Appium 2.x with UiAutomator2 driver installed
- A running Pixel 8 API 34 emulator that `adb devices` reports as online
- Appium server running on localhost:4723, returning `"ready": true` from `/status`
- `.vscode/mcp.json` configured with both Playwright and Appium MCP servers, VS Code reloaded
- `output/.env` pointing at your app's `APP_PACKAGE` + `APP_ACTIVITY`
- A passing framework parity verification spec, proving the full stack works
- At least one real scenario of your own authored + Explorer-generated + running green

**Next steps:** read the [Mobile Test Automation](../../README.md#mobile-test-automation) section of the main README for deeper material on writing mobile scenarios, handling popups, anti-patterns, and CI integration. For the Platform header convention (required on every mobile scenario), see [Mobile Platform Targeting](../../README.md#mobile-platform-targeting--platform-header-convention).
