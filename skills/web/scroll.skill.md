# Skill: web/scroll

## Input
- **target** ('element' | 'bottom' | 'top' | 'position', required): What to scroll to
- **selector** (string, optional): Element to scroll into view (when target='element')
- **pixels** (number, optional): Pixel offset for position-based scrolling

## Output
- **scrolled** (boolean), **finalPosition** (number)

## Behavior
1. If target='element': use `locator.scrollIntoViewIfNeeded()` — MUST verify element is in viewport after scroll
2. If target='bottom': use `page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))`
3. If target='top': use `page.evaluate(() => window.scrollTo(0, 0))`
4. For infinite scroll / virtual lists: scroll → wait for new content → repeat until target found or end reached

## Rules — MUST Follow
- **MUST** use `scrollIntoViewIfNeeded()` for element targeting — NOT manual pixel calculations
- **MUST** wait for content to load after scroll (virtual lists load lazily)
- **MUST NOT** assume all content is rendered — enterprise grids use virtual scrolling

## Code Patterns
```typescript
// Scroll element into view
await page.locator(loc.get('targetElement')).scrollIntoViewIfNeeded();

// Scroll to page bottom
await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

// Infinite scroll — load all items
let previousHeight = 0;
while (true) {
  const currentHeight = await page.evaluate(() => document.body.scrollHeight);
  if (currentHeight === previousHeight) break;
  previousHeight = currentHeight;
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForLoadState('networkidle');
}

// Mouse wheel scroll
await page.mouse.wheel(0, 500);
```

## Known Patterns
- **Virtual lists (AG Grid, React Virtualized):** Only visible rows are in DOM — scroll to load more
- **Sticky headers:** May overlap target element after scroll — account for header height
