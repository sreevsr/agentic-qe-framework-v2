/**
 * mui-select.skill.js — Interaction recipe for MUI (Material UI) Select component.
 *
 * MUI Select is NOT a native <select>. It's a div-based custom component:
 *   - The visible "display" div shows the current value
 *   - Clicking the WRAPPER (MuiInputBase-root) opens a dropdown menu (MuiMenu-paper)
 *   - Options are MuiMenuItem-root elements inside the menu
 *   - Clicking an option closes the menu and updates the display
 *
 * Playwright's selectOption() does NOT work on MUI Select.
 * This skill provides the correct multi-step interaction.
 *
 * Usage in plan:
 *   { "type": "SKILL", "action": { "skill": "mui-select/pick", "params": { "selector": "#my-select", "value": "Option text" } } }
 *
 * Or called automatically by the component-aware action handler.
 */

/**
 * Pick a value from a MUI Select dropdown.
 *
 * @param {import('playwright').Page} page
 * @param {object} params
 * @param {string} params.selector - CSS selector for the select display element (the div with id like mui-component-select-*)
 * @param {string} params.value - The option text to select
 * @param {number} [params.timeout=10000] - Max wait time
 * @returns {object} { selected: string, previousValue: string }
 */
async function pick(page, params) {
  const { selector, value, timeout = 10000 } = params;

  // Step 1: Find the select display element
  const displayEl = page.locator(selector).first();
  await displayEl.waitFor({ state: 'visible', timeout });

  // Read current value
  const previousValue = await displayEl.textContent() || '';

  // Step 2: Find the wrapper (MuiInputBase-root) — this is what we click to open
  // The wrapper is either the element itself or an ancestor with MuiInputBase-root
  const wrapper = page.locator(`
    ${selector}:is(.MuiInputBase-root),
    .MuiInputBase-root:has(${selector}),
    .MuiFormControl-root:has(${selector}) .MuiInputBase-root
  `.trim().replace(/\s+/g, ' ')).first();

  // If wrapper found, click it. Otherwise click the display element directly.
  const clickTarget = await wrapper.count() > 0 ? wrapper : displayEl;
  await clickTarget.click({ timeout });

  // Step 3: Wait for the dropdown menu to appear
  const menu = page.locator('.MuiMenu-paper, .MuiPopover-paper, [role="listbox"]').first();
  await menu.waitFor({ state: 'visible', timeout });

  // Step 4: Find and click the option with matching text
  // MUI options are MuiMenuItem-root elements, or elements with role="option"
  const option = menu.locator(`.MuiMenuItem-root:has-text("${value}"), [role="option"]:has-text("${value}")`).first();

  if (await option.count() === 0) {
    // List all available options for error reporting
    const allOptions = menu.locator('.MuiMenuItem-root, [role="option"]');
    const count = await allOptions.count();
    const available = [];
    for (let i = 0; i < Math.min(count, 20); i++) {
      available.push(await allOptions.nth(i).textContent());
    }
    throw new Error(`MUI Select: option "${value}" not found. Available: ${available.join(', ')}`);
  }

  await option.click({ timeout });

  // Step 5: Wait for menu to close
  await menu.waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {});

  // Verify the selection took effect
  const newValue = await displayEl.textContent() || '';

  return {
    selected: value,
    previousValue: previousValue.trim(),
    confirmedValue: newValue.trim(),
  };
}

/**
 * Read the current value of a MUI Select without changing it.
 *
 * @param {import('playwright').Page} page
 * @param {object} params
 * @param {string} params.selector - CSS selector for the select display element
 * @returns {string} Current selected value text
 */
async function read(page, params) {
  const { selector, timeout = 5000 } = params;
  const displayEl = page.locator(selector).first();
  await displayEl.waitFor({ state: 'visible', timeout });
  return (await displayEl.textContent() || '').trim();
}

/**
 * Get all available options from a MUI Select dropdown.
 *
 * @param {import('playwright').Page} page
 * @param {object} params
 * @param {string} params.selector - CSS selector for the select display element
 * @returns {string[]} List of option texts
 */
async function listOptions(page, params) {
  const { selector, timeout = 10000 } = params;

  // Open the dropdown
  const displayEl = page.locator(selector).first();
  const wrapper = page.locator(`.MuiInputBase-root:has(${selector}), .MuiFormControl-root:has(${selector}) .MuiInputBase-root`).first();
  const clickTarget = await wrapper.count() > 0 ? wrapper : displayEl;
  await clickTarget.click({ timeout });

  // Wait for menu
  const menu = page.locator('.MuiMenu-paper, .MuiPopover-paper, [role="listbox"]').first();
  await menu.waitFor({ state: 'visible', timeout });

  // Read all options
  const allOptions = menu.locator('.MuiMenuItem-root, [role="option"]');
  const count = await allOptions.count();
  const options = [];
  for (let i = 0; i < count; i++) {
    const text = await allOptions.nth(i).textContent();
    if (text) options.push(text.trim());
  }

  // Close by pressing Escape
  await page.keyboard.press('Escape');
  await menu.waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {});

  return options;
}

module.exports = { pick, read, listOptions };
