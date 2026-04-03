/**
 * telerik-dropdown.skill.js — Interaction recipe for Telerik RadDropDownList.
 *
 * Telerik RadDropDownList is NOT a native <select>. It's a div-based component:
 *   - The visible element (#ComponentId) shows the current value
 *   - Clicking it opens a dropdown panel (#ComponentId_DropDown) with <li> items
 *   - Standard selectOption() does NOT work
 *   - IMPORTANT: Use :text-is() for exact matching — :has-text() is substring
 *     and causes strict mode when options share prefixes (e.g., "HOME DEPOT"
 *     vs "Home Depot Flipped - CONWAY")
 *
 * Usage in plan:
 *   { "type": "SKILL", "action": { "skill": "telerik-dropdown/pick", "params": { "triggerSelector": "#SourceInput", "dropdownSelector": "#SourceInput_DropDown", "value": "HOME DEPOT" } } }
 *
 * Or called automatically by the component-aware action handler.
 */

/**
 * Pick a value from a Telerik RadDropDownList.
 *
 * @param {import('playwright').Page} page
 * @param {object} params
 * @param {string} params.triggerSelector - CSS selector for the dropdown trigger (e.g., #SourceInput)
 * @param {string} params.dropdownSelector - CSS selector for the dropdown panel (e.g., #SourceInput_DropDown)
 * @param {string} params.value - The option text to select (exact match)
 * @param {number} [params.timeout=10000] - Max wait time
 * @returns {object} { selected, previousValue, confirmedValue }
 */
async function pick(page, params) {
  const { triggerSelector, dropdownSelector, value, timeout = 10000 } = params;

  // Step 1: Read current value
  const trigger = page.locator(triggerSelector).first();
  await trigger.waitFor({ state: 'visible', timeout });
  const previousValue = (await trigger.textContent() || '').trim();

  // Step 2: Click to open dropdown
  await trigger.click({ timeout });

  // Step 3: Wait for dropdown panel
  const dropdown = page.locator(dropdownSelector).first();
  await dropdown.waitFor({ state: 'visible', timeout });

  // Step 4: Find and click the exact matching option
  // Use :text-is() for exact case-insensitive match (avoids substring false positives)
  const option = dropdown.locator(`li:text-is('${value}')`).first();

  if (await option.count() === 0) {
    // List available options for error reporting
    const allOptions = dropdown.locator('li');
    const count = await allOptions.count();
    const available = [];
    for (let i = 0; i < Math.min(count, 20); i++) {
      const text = await allOptions.nth(i).textContent();
      if (text) available.push(text.trim());
    }
    throw new Error(`Telerik DropDownList: option "${value}" not found. Available: ${available.join(', ')}`);
  }

  // JS click for Telerik compatibility
  await option.evaluate((el) => {
    el.click();
  });

  // Step 5: Wait for dropdown to close
  await dropdown.waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {});

  // Verify selection
  const confirmedValue = (await trigger.textContent() || '').trim();

  return {
    selected: value,
    previousValue,
    confirmedValue,
  };
}

/**
 * Read the current value of a Telerik RadDropDownList.
 */
async function read(page, params) {
  const { triggerSelector, timeout = 5000 } = params;
  const trigger = page.locator(triggerSelector).first();
  await trigger.waitFor({ state: 'visible', timeout });
  return (await trigger.textContent() || '').trim();
}

/**
 * Get all available options from a Telerik RadDropDownList.
 */
async function listOptions(page, params) {
  const { triggerSelector, dropdownSelector, timeout = 10000 } = params;

  const trigger = page.locator(triggerSelector).first();
  await trigger.click({ timeout });

  const dropdown = page.locator(dropdownSelector).first();
  await dropdown.waitFor({ state: 'visible', timeout });

  const allOptions = dropdown.locator('li');
  const count = await allOptions.count();
  const options = [];
  for (let i = 0; i < count; i++) {
    const text = await allOptions.nth(i).textContent();
    if (text) options.push(text.trim());
  }

  // Close by pressing Escape
  await page.keyboard.press('Escape');
  await dropdown.waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {});

  return options;
}

module.exports = { pick, read, listOptions };
