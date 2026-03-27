# Skill: mobile/android-specific

## Android-Only Capabilities

### Locator Strategies
```typescript
// UiAutomator2 selector (fast, reliable)
const element = await $('android=new UiSelector().text("Submit")');
const scrollable = await $('android=new UiScrollable(new UiSelector().scrollable(true)).scrollTextIntoView("Settings")');

// Resource ID
const element = await $('id=com.app.package:id/login_button');

// Content description (accessibility)
const element = await $('~loginButton'); // accessibility_id
```

### Android-Specific Actions
```typescript
// Open notifications panel
await driver.openNotifications();

// Press Android-specific keys
await driver.pressKeyCode(4);   // Back
await driver.pressKeyCode(3);   // Home
await driver.pressKeyCode(187); // Recent apps

// Get current activity
const activity = await driver.getCurrentActivity();
expect(activity).toBe('.LoginActivity');

// Handle "App not responding" dialog
const waitBtn = await $('id=android:id/button1');
if (await waitBtn.isDisplayed()) await waitBtn.click();

// Set device orientation
await driver.setOrientation('LANDSCAPE');
```

### Android Capabilities (in .env)
```
ANDROID_APP_PACKAGE=com.example.app
ANDROID_APP_ACTIVITY=.MainActivity
ANDROID_DEVICE_NAME=Pixel_7_API_34
ANDROID_PLATFORM_VERSION=14
ANDROID_AUTOMATION_NAME=UiAutomator2
```

## Rules — MUST Follow
- **MUST** use UiAutomator2 as automation engine (NOT deprecated Appium 1.x drivers)
- **MUST** set `appWaitActivity` if app has splash screen → main activity transition
- For emulators: **MUST** ensure AVD is running before test starts
