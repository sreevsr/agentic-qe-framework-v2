# Skill: mobile/app-management

## Input
- **action** ('install' | 'uninstall' | 'activate' | 'terminate' | 'background' | 'reset' | 'permissions', required)
- **appId** (string, optional): App package/bundleId
- **permission** (string, optional): Permission to grant/deny
- **seconds** (number, optional): Duration for background

## Output
- **success** (boolean), **appState** (string)

## Rules — MUST Follow
- **MUST** handle permission dialogs that appear after app launch (camera, location, notifications)
- **MUST** use `driver.terminateApp()` for clean teardown — NOT just closing
- **MUST NOT** assume app state persists between tests — use explicit setup

## Code Patterns
```typescript
// Background app and resume
await driver.background(5); // 5 seconds in background
// App automatically resumes

// Terminate and relaunch (clean state)
await driver.terminateApp(process.env.APP_PACKAGE!);
await driver.activateApp(process.env.APP_PACKAGE!);

// Handle Android permission dialog
const allowButton = await $('id=com.android.permissioncontroller:id/permission_allow_button');
if (await allowButton.isDisplayed()) {
  await allowButton.click();
}

// Handle iOS permission dialog
const allowBtn = await $('-ios predicate string:label == "Allow"');
if (await allowBtn.isDisplayed()) {
  await allowBtn.click();
}

// Reset app (clear data)
await driver.resetApp();
```

## Known Patterns
- **First launch permissions:** Android and iOS show permission dialogs on first use — MUST handle
- **Enterprise apps with MDM:** May have additional compliance screens after install
- **Session state:** WDIO reuses sessions — explicit app reset between scenarios may be needed
