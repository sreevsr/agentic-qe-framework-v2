# Skill: mobile/interact

## Input
- **action** ('tap' | 'type' | 'longPress' | 'swipe' | 'scroll' | 'pinch' | 'zoom' | 'clear', required)
- **selector** (string, required): Element locator via mobile LocatorLoader
- **value** (string, optional): For type action
- **direction** ('up' | 'down' | 'left' | 'right', optional): For swipe/scroll

## Output
- **success** (boolean), **elementFound** (boolean)

## Rules — MUST Follow
- **MUST** use accessibility_id as primary locator strategy (cross-platform)
- **MUST** clear field before typing — mobile inputs don't auto-clear like web
- **MUST** dismiss keyboard after typing if it blocks next element: `driver.hideKeyboard()`
- **MUST NOT** use XPath with index as primary — fragile across devices/OS versions
- For gestures (pinch/zoom/swipe): **MUST** use W3C Actions API — NOT deprecated touch actions

## Locator Priority (Mobile)
1. `accessibility_id` (contentDescription on Android, accessibilityIdentifier on iOS) — ALWAYS prefer
2. `id` (resource-id on Android, name on iOS)
3. `class name` + text predicate
4. Android: `UiSelector` (`new UiAutomator('new UiSelector().text("Submit")')`)
5. iOS: `-ios class chain` or `-ios predicate string`
6. XPath — LAST resort, NEVER with index

## Code Patterns (WebdriverIO)
```typescript
// Tap
await $('~loginButton').click();

// Type (with clear first)
const field = await $('~emailInput');
await field.clearValue();
await field.setValue('user@example.com');
await driver.hideKeyboard();

// Long press
await driver.touchAction([
  { action: 'longPress', element: await $('~listItem') },
  { action: 'release' }
]);

// Swipe (W3C Actions)
await driver.performActions([{
  type: 'pointer', id: 'finger1',
  parameters: { pointerType: 'touch' },
  actions: [
    { type: 'pointerMove', x: 500, y: 1500, duration: 0 },
    { type: 'pointerDown', button: 0 },
    { type: 'pointerMove', x: 500, y: 500, duration: 800 },
    { type: 'pointerUp', button: 0 },
  ]
}]);

// Scroll to element
await driver.execute('mobile: scrollGesture', {
  direction: 'down', percent: 0.75
});
```

## Known Patterns
- **Keyboard obscuring elements:** After typing, keyboard may cover the next element — MUST hide keyboard
- **Android vs iOS gestures:** Same logical gesture has different coordinate systems — use % not absolute pixels
- **Slow animations:** Enterprise apps may have screen transition animations — wait for animation to complete
