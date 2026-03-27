# Skill: mobile/ios-specific

## iOS-Only Capabilities

### Locator Strategies
```typescript
// iOS Class Chain (recommended — fast, readable)
const element = await $('-ios class chain:**/XCUIElementTypeButton[`label == "Submit"`]');
const cell = await $('-ios class chain:**/XCUIElementTypeCell[`name CONTAINS "Settings"`]');

// iOS Predicate String (flexible)
const element = await $('-ios predicate string:label == "Login" AND type == "XCUIElementTypeButton"');
const visible = await $('-ios predicate string:visible == 1 AND name BEGINSWITH "item"');

// Accessibility ID (cross-platform — ALWAYS prefer when available)
const element = await $('~loginButton');
```

### iOS-Specific Actions
```typescript
// Handle iOS permission alert ("Allow" / "Don't Allow")
const alert = await driver.getAlertText().catch(() => null);
if (alert) {
  await driver.acceptAlert(); // or driver.dismissAlert()
}

// iOS-specific swipe (using mobile: commands)
await driver.execute('mobile: swipe', { direction: 'up' });

// Tap by coordinates (for elements without accessibility)
await driver.execute('mobile: tap', { x: 200, y: 400 });

// Set device orientation
await driver.setOrientation('PORTRAIT');

// Handle Face ID / Touch ID (simulator only)
await driver.execute('mobile: enrollBiometric', { isEnabled: true });
await driver.execute('mobile: sendBiometricMatch', { type: 'faceId', match: true });

// Shake device
await driver.execute('mobile: shake');
```

### iOS Capabilities (in .env)
```
IOS_BUNDLE_ID=com.example.app
IOS_DEVICE_NAME=iPhone 15 Pro
IOS_PLATFORM_VERSION=17.4
IOS_AUTOMATION_NAME=XCUITest
IOS_XCODE_ORG_ID=your-team-id
IOS_XCODE_SIGNING_ID=iPhone Developer
```

## Rules — MUST Follow
- **MUST** use XCUITest as automation engine
- **MUST** handle WDA (WebDriverAgent) setup — use `skills/auth/sso-login.skill.md` patterns for Apple ID if needed
- **MUST** use `-ios class chain` or `-ios predicate string` over XPath — XPath is extremely slow on iOS
- For simulators: **MUST** boot simulator before test starts
- For real devices: **MUST** configure code signing (xcodeOrgId, xcodeSigningId)
