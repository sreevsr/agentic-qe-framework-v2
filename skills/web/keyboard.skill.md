# Skill: web/keyboard

## Input
- **action** ('press' | 'type' | 'shortcut', required)
- **keys** (string, required): Key or combination (e.g., 'Enter', 'Control+S', 'Escape')

## Output
- **pressed** (boolean)

## Rules — MUST Follow
- **MUST** use `page.keyboard.press()` for single keys and shortcuts
- **MUST** use modifier format: `Control+S`, `Shift+Tab`, `Alt+F4`, `Meta+A` (Meta = Cmd on Mac)
- For Mac compatibility: use `Meta` not `Command` in shortcuts

## Code Patterns
```typescript
// Press Enter
await page.keyboard.press('Enter');

// Keyboard shortcut (Ctrl+S / Cmd+S)
await page.keyboard.press('Control+S');

// Escape to close modal/dropdown
await page.keyboard.press('Escape');

// Tab navigation
await page.keyboard.press('Tab');
await page.keyboard.press('Shift+Tab'); // reverse tab

// Select all + delete (clear field alternative)
await page.keyboard.press('Control+A');
await page.keyboard.press('Backspace');

// Type text character by character (alternative to fill)
await page.keyboard.type('search query', { delay: 50 });
```

## Known Patterns
- **Enterprise shortcuts:** Ctrl+S (save), Ctrl+Z (undo), Ctrl+F (search) — common in admin panels
- **Escape key:** Closes modals, dropdowns, tooltips in most frameworks
- **Tab order testing:** Accessibility testing requires Tab navigation verification
