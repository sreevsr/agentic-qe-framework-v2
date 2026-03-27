# Skill: web/multi-tab

## Input
- **action** ('waitForPopup' | 'switchTo' | 'close' | 'listAll', required)
- **index** (number, optional): Tab index for switchTo

## Output
- **pageCount** (number), **currentUrl** (string)

## Rules — MUST Follow
- **MUST** set up popup listener BEFORE clicking the link that opens a new tab
- **MUST** use `Promise.all` pattern to catch the popup event
- **MUST** close new tabs when done to avoid state leakage

## Code Patterns
```typescript
// Wait for new tab/popup opened by clicking a link
const [newPage] = await Promise.all([
  page.context().waitForEvent('page'),
  page.locator(loc.get('openInNewTab')).click(),
]);
await newPage.waitForLoadState('networkidle');
expect(newPage.url()).toContain('/external-report');
// Do work in new tab...
await newPage.close();

// OAuth popup flow
const [popup] = await Promise.all([
  page.context().waitForEvent('page'),
  page.locator(loc.get('googleSignIn')).click(),
]);
await popup.waitForLoadState();
await popup.locator('#email').fill(process.env.GOOGLE_EMAIL!);
// ... complete OAuth in popup, it closes automatically

// List all open pages
const pages = page.context().pages();
console.log(`${pages.length} tabs open`);
```

## Known Patterns
- **OAuth/SSO popups:** Open in new window, close after auth completes
- **Print preview:** Opens in new tab — verify content, then close
- **External links:** `target="_blank"` opens new tab — verify URL and content
