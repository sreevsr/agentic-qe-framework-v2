# Onboarding Guides

Step-by-step setup guides for running the Agentic QE Framework v2 against different target platforms. Pick the guide that matches your test target, follow it end-to-end, and you'll have a verified working setup before writing your first real scenario.

**Before starting any guide here**, make sure you've already completed the core framework setup in the [main README](../../README.md#setup):

1. Cloned the repo and run `npm install`
2. Run `npm run setup` (which populates `output/` from templates)
3. Installed VS Code + GitHub Copilot **or** Claude Code CLI
4. Verified `node --version` prints 18+ and `java --version` prints 17+

The guides below assume those steps are done. Each guide then walks through the platform-specific setup: installing Appium drivers, creating/connecting a device, configuring capabilities, and running a first verification test.

## Pick Your Target Platform

| Target | Guide | Prerequisites | Complexity | Typical setup time |
|---|---|---|---|---|
| **Android emulator** on your dev laptop | [android-emulator.md](android-emulator.md) | Android Studio OR standalone `cmdline-tools`, hardware virtualization enabled | ⭐ Easy | 30-60 min |
| **Real Android device** via USB | [android-device.md](android-device.md) | USB cable, developer options enabled on device, OEM USB drivers (Windows) | ⭐ Easy | 20-40 min |
| **iOS Simulator** on macOS | [ios-simulator.md](ios-simulator.md) | macOS + Xcode + Command Line Tools | ⭐⭐ Medium (Xcode install is heavy) | 60-90 min |
| **Real iOS device** | [ios-device.md](ios-device.md) | macOS + Xcode + Apple Developer account + Carthage + device provisioning profiles | ⭐⭐⭐⭐ Hard (and **not yet device-verified on this framework**) | 2-4 hours (first time) |
| **BrowserStack / Sauce Labs / LambdaTest** cloud | [cloud-farms.md](cloud-farms.md) | Cloud account with credentials, app uploaded via vendor API | ⭐⭐ Medium | 45-90 min |
| **AWS Device Farm** | [aws-device-farm.md](aws-device-farm.md) | AWS account, IAM credentials, awscli installed, test bundle packaging | ⭐⭐⭐ Medium-Hard (different execution model) | 60-120 min |

## What Each Guide Covers

Every guide follows the same structure so you know what to expect:

1. **Prerequisites** — what you need before starting (tools, accounts, hardware)
2. **Install the toolchain** — Appium driver, SDK, cloud CLI, or equivalent
3. **Create / connect the device** — emulator creation, USB setup, cloud account config
4. **Install the app under test** — APK/IPA via ADB, `APP_PATH`, cloud upload, or native installer
5. **Configure `output/.env`** — device serial, app package, platform, auth
6. **Configure MCP servers** (VS Code Copilot path) or equivalent for Claude Code CLI
7. **Smoke test** — run a framework parity verification spec to confirm the full stack works
8. **Write and run your first real scenario** — Explorer → Builder → Executor → Reviewer
9. **Troubleshooting** — common failure modes for that specific platform + fixes

## iOS Support Status — Please Read Before Starting an iOS Guide

The framework's mobile infrastructure (capabilities, locator loader, BaseScreen gestures, platform-keyed JSON) supports iOS by design. **However, as of the current release, iOS has not been device-verified by the framework maintainers.** All 9 mobile parity verification tests and the Flipkart end-to-end regression were run on Android only.

When you run iOS for the first time, expect to hit unknowns that the Android guide doesn't have equivalents for:
- **WebDriverAgent (WDA) build + code-signing** — first-time friction that can take 30-60 minutes to resolve
- **Android-only `BaseScreen` methods** — `selectOption()` hardcodes `android=new UiSelector()`, `waitForActivity()` uses Android Activities — these need screen-specific replacements for iOS
- **Locator coverage** — most existing locator JSON files only have `android:` sub-objects; running existing cross-platform scenarios on iOS will surface missing `ios:` entries

The [ios-simulator.md](ios-simulator.md) guide is written from Apple + Appium documentation and should be reliable enough for most teams to get started. The [ios-device.md](ios-device.md) guide contains the full setup path but is explicitly flagged as **not yet verified on this framework** — treat it as a starting point, expect trial-and-error, and please contribute your fixes back via pull request or by updating `scenarios/app-contexts/{app}-ios.md` with learned patterns.

## Quick Decision Tree

**Need to test on a real Android device your team provides?** → [android-device.md](android-device.md)
**Developer machine, no physical devices, just want to get started fast?** → [android-emulator.md](android-emulator.md)
**Cross-platform (Android + iOS) testing from a Mac?** → [android-emulator.md](android-emulator.md) + [ios-simulator.md](ios-simulator.md)
**CI/CD pipeline with real devices but no physical device lab?** → [cloud-farms.md](cloud-farms.md) (BrowserStack/Sauce Labs/LambdaTest)
**Enterprise AWS environment with an approved device pool?** → [aws-device-farm.md](aws-device-farm.md)

## When You Get Stuck

Each guide has a troubleshooting section at the end covering platform-specific failure modes. For framework-level issues (Explorer can't find elements, Builder generates wrong code, Executor loops on the same error), see the main README's [Troubleshooting](../../README.md#troubleshooting) and [Mobile Failure Signatures](../../README.md#mobile-failure-signatures) sections.

If your issue isn't covered anywhere, please open a GitHub issue with:
- Which guide you were following
- Which step failed
- The exact error message
- Your OS + Node version + Appium version
- Device / emulator / cloud details
