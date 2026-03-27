# Skill: web/dialog

## Input
- **action** ('accept' | 'dismiss' | 'getText' | 'fill', required): How to handle the dialog
- **inputText** (string, optional): Text for prompt dialogs

## Output
- **handled** (boolean), **dialogMessage** (string)

## Rules — MUST Follow
- **MUST** register dialog handler BEFORE triggering the action that opens the dialog
- **MUST** use `page.on('dialog')` — this handles alert(), confirm(), prompt(), beforeunload
- **MUST NOT** use `{ force: true }` to bypass dialogs — handle them properly
- For app-level modals (not browser dialogs): use `web/interact` skill instead — these are DOM elements, not browser dialogs

## Code Patterns
```typescript
// Accept a confirmation dialog
page.on('dialog', async dialog => {
  expect(dialog.message()).toContain('Are you sure');
  await dialog.accept();
});
await page.locator(loc.get('deleteButton')).click();

// Dismiss (cancel) a dialog
page.on('dialog', async dialog => {
  await dialog.dismiss();
});
await page.locator(loc.get('closeButton')).click();

// Fill a prompt dialog
page.on('dialog', async dialog => {
  await dialog.accept('New folder name');
});
await page.locator(loc.get('renameButton')).click();

// Handle beforeunload (unsaved changes warning)
page.on('dialog', async dialog => {
  if (dialog.type() === 'beforeunload') await dialog.accept();
});
await page.locator(loc.get('navigateAway')).click();
```

## Known Patterns
- **Delete confirmations:** Almost all enterprise apps have confirm() before destructive actions
- **Unsaved changes:** beforeunload dialog fires when navigating away from dirty forms
- **Session timeout:** Some apps use alert() for session expiry — handle and re-authenticate
