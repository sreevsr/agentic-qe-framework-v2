# UI Component Interaction Patterns — Reference

**WARNING: This file is a HUMAN REFERENCE ONLY. Agents MUST NOT read or use this file.**

The selectors below are version-specific and WILL go stale as UI frameworks update. They exist solely to help humans understand HOW different component libraries structure their DOM — not as copy-paste patterns.

**In v2, the Explorer/Builder discovers component patterns LIVE from the real app.** It does NOT need this reference. If you find yourself copying selectors from here into code, STOP — let the Explorer/Builder discover the current selectors instead.

**When this file is useful:**
- Learning how Kendo/Fluent/MUI dropdowns work (conceptual understanding, not exact selectors)
- Writing initial `*.helpers.ts` files when you know your app's framework
- Onboarding new team members to enterprise UI component complexity

**When this file is NOT useful:**
- As a source of truth for selectors (they go stale)
- As input for the Explorer/Builder (it uses app-context, not this file)
- As a substitute for live exploration

---

## Fluent UI (Microsoft)

### ComboBox
```typescript
// Two-step: click to open → type to filter → click option
await page.locator(comboboxSelector).click();
await page.locator(`${comboboxSelector} input`).fill(searchText);
await page.locator(`.ms-ComboBox-optionsContainer button:has-text("${optionText}")`).click();
```

### Dropdown
```typescript
await page.locator(dropdownSelector).click();
await page.locator(`.ms-Dropdown-callout button:has-text("${optionText}")`).click();
```

### Panel (Side Panel)
```typescript
// Wait for panel to open
await page.waitForSelector('.ms-Panel-main', { state: 'visible' });
// Close
await page.locator('.ms-Panel-closeButton').click();
```

### Dialog
```typescript
await page.waitForSelector('.ms-Dialog-main', { state: 'visible' });
await page.locator('.ms-Dialog-main').locator(`button:has-text("${buttonText}")`).click();
```

---

## MUI (Material UI)

### Select
```typescript
await page.locator(selectSelector).click();
await page.locator(`.MuiMenu-list li:has-text("${optionText}")`).click();
```

### Autocomplete
```typescript
await page.locator(`${autocompleteSelector} input`).fill(searchText);
await page.locator(`.MuiAutocomplete-listbox li:has-text("${optionText}")`).click();
```

### Dialog
```typescript
await page.waitForSelector('.MuiDialog-root', { state: 'visible' });
await page.locator('.MuiDialogActions-root').locator(`button:has-text("${buttonText}")`).click();
```

---

## Kendo UI (Telerik)

### Dropdown
```typescript
await page.locator(dropdownSelector).click();
await page.locator('.k-animation-container .k-list-item').filter({ hasText: optionText }).click();
```

### ComboBox (with type-to-filter)
```typescript
await page.locator(comboboxSelector).click();
await page.locator(`${comboboxSelector} input`).pressSequentially(searchText, { delay: 100 });
await page.locator('.k-animation-container .k-list-item').filter({ hasText: optionText }).click();
```

### Dialog
```typescript
await page.waitForSelector('.k-dialog', { state: 'visible' });
await page.locator('.k-dialog-close').click();
```

---

## Ant Design

### Select
```typescript
await page.locator(selectSelector).click();
await page.locator(`.ant-select-dropdown .ant-select-item:has-text("${optionText}")`).click();
```

### Modal
```typescript
await page.waitForSelector('.ant-modal', { state: 'visible' });
await page.locator('.ant-modal-close').click();
```

### Drawer
```typescript
await page.waitForSelector('.ant-drawer', { state: 'visible' });
await page.locator('.ant-drawer-close').click();
```

---

## PrimeNG / PrimeReact

### Dropdown
```typescript
await page.locator(dropdownSelector).click();
await page.locator('.p-dropdown-panel .p-dropdown-item').filter({ hasText: optionText }).click();
```

### Dialog
```typescript
await page.waitForSelector('.p-dialog', { state: 'visible' });
await page.locator('.p-dialog-header-close').click();
```

---

## Bootstrap

### Dropdown
```typescript
await page.locator(toggleSelector).click();
await page.locator('.dropdown-menu.show .dropdown-item').filter({ hasText: itemText }).click();
```

### Modal
```typescript
await page.waitForSelector('.modal.show', { state: 'visible' });
await page.locator('[data-bs-dismiss="modal"]').first().click();
```

---

## Power Apps PCF Controls

### Data Grid
```
- Sort/filter icons are SVG elements, NOT IMG
- Use: th:nth-child(N) svg:last-of-type for filter icons
- Grid content loads asynchronously — need waitForFunction() for cell values
- Filter inputs require pressSequentially() to trigger search
```

### Custom Dropdowns
```
- DO NOT use selectOption() — PCF dropdowns are custom, not native
- Pattern: click to open → wait for panel → click option
- Panel may render outside the grid container
```

---

## Common Cross-Framework Patterns

### Date Picker
```typescript
// Most date pickers: click input → navigate to month → click day
await page.locator(dateInputSelector).click();
// Navigate months if needed
await page.locator('.calendar-nav-next').click(); // or similar
await page.locator(`.calendar-day:has-text("${day}")`).click();
```

### Rich Text Editor (contenteditable)
```typescript
// For contenteditable divs (CKEditor, TinyMCE, Quill)
const editor = page.locator(editorSelector);
await editor.click();
await page.keyboard.type(text);
// OR for replacing content:
await editor.evaluate((el, val) => { el.innerHTML = val; }, htmlContent);
```

### Autocomplete/Typeahead
```typescript
// Type slowly to trigger server lookup
await page.locator(inputSelector).pressSequentially(searchText, { delay: 100 });
// Wait for suggestions
await page.waitForSelector('.suggestion-list', { state: 'visible' });
await page.locator(`.suggestion-item:has-text("${selectedText}")`).click();
```
