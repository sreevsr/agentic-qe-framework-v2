# Skill: web/drag-drop

## Input
- **sourceSelector** (string, required): Element to drag
- **targetSelector** (string, required): Element to drop onto

## Output
- **success** (boolean)

## Rules — MUST Follow
- **MUST** try `locator.dragTo()` first — cleanest API
- If `dragTo()` fails (custom drag implementations): **MUST** fall back to manual mouse events
- **MUST** verify the drop was successful (element moved, list reordered, etc.)

## Code Patterns
```typescript
// Playwright built-in drag-and-drop
await page.locator(loc.get('dragItem')).dragTo(page.locator(loc.get('dropZone')));

// Manual mouse-based (for custom drag implementations)
const source = page.locator(loc.get('dragItem'));
const target = page.locator(loc.get('dropZone'));
await source.hover();
await page.mouse.down();
await target.hover();
await page.mouse.up();

// With intermediate steps (for sortable lists)
const sourceBox = await source.boundingBox();
const targetBox = await target.boundingBox();
await page.mouse.move(sourceBox!.x + sourceBox!.width / 2, sourceBox!.y + sourceBox!.height / 2);
await page.mouse.down();
await page.mouse.move(targetBox!.x + targetBox!.width / 2, targetBox!.y + targetBox!.height / 2, { steps: 10 });
await page.mouse.up();
```

## Known Patterns
- **Kanban boards (Jira, Trello):** Use library-specific drag — may need manual mouse events
- **Dashboard layout editors:** Grid-based drag needs precise coordinates
- **React Beautiful DnD / DnD Kit:** Often need `steps` parameter in mouse.move for smooth drag
