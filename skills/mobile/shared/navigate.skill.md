# Skill: mobile/navigate

## Input
- **action** ('launchApp' | 'deepLink' | 'back' | 'home' | 'switchContext', required)
- **appPackage** (string, optional): Android package / iOS bundleId
- **url** (string, optional): Deep link URL
- **context** ('NATIVE_APP' | 'WEBVIEW_*', optional): For webview context switching

## Output
- **launched** (boolean), **currentActivity** (string), **currentContext** (string)

## Rules — MUST Follow
- **MUST** use Appium MCP tools for all navigation: `launch_app`, `back`, `deep_link`
- **MUST** wait for app/screen to be ready after launch or navigation
- **MUST** use `switchContext()` when moving between native and webview — NEVER interact with webview elements in native context
- **MUST** read capabilities from environment: `{{ENV.APP_PACKAGE}}`, `{{ENV.APP_ACTIVITY}}`

## Code Patterns (WebdriverIO + Appium)
```typescript
// Launch app
await driver.launchApp();
await driver.waitUntil(async () => (await driver.getCurrentActivity()) === '.MainActivity');

// Deep link
await driver.url('myapp://profile/settings');

// Back button
await driver.back();

// Switch to WebView context
const contexts = await driver.getContexts();
const webview = contexts.find(c => c.includes('WEBVIEW'));
await driver.switchContext(webview!);
// ... interact with web elements ...
await driver.switchContext('NATIVE_APP'); // back to native

// Navigate between screens
await screenObject.tapMenuItem('Settings');
await driver.waitUntil(async () => (await $('~settings-header')).isDisplayed());
```

## Known Patterns
- **Hybrid apps:** Frequently switch between NATIVE_APP and WEBVIEW — MUST track current context
- **Deep links:** Enterprise apps use custom URL schemes — configure in capabilities
- **Back navigation:** Android hardware back vs iOS swipe-back behave differently
