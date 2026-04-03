/**
 * telerik-combobox.skill.js — Interaction recipe for Telerik RadComboBox.
 *
 * Telerik RadComboBox is NOT a native <select>. It's an autocomplete component:
 *   - The visible input (#ComponentId_Input) accepts typed text for filtering
 *   - The dropdown panel (#ComponentId_DropDown) renders filtered options as <li> items
 *   - Standard selectOption() does NOT work
 *
 * Interaction pattern:
 *   1. Click the input to focus/open
 *   2. Type the filter text
 *   3. Wait for dropdown to appear
 *   4. Click the matching <li> item via JS dispatch (mousedown + click)
 *
 * Usage in plan:
 *   { "type": "SKILL", "action": { "skill": "telerik-combobox/pick", "params": { "inputSelector": "#ProblemInput_Input", "dropdownSelector": "#ProblemInput_DropDown", "value": "Heating Tune-up" } } }
 *
 * Or called automatically by the component-aware action handler.
 */

/**
 * Pick a value from a Telerik RadComboBox.
 *
 * @param {import('playwright').Page} page
 * @param {object} params
 * @param {string} params.inputSelector - CSS selector for the combobox input (e.g., #ProblemInput_Input)
 * @param {string} params.dropdownSelector - CSS selector for the dropdown panel (e.g., #ProblemInput_DropDown)
 * @param {string} params.value - The option text to select
 * @param {number} [params.timeout=10000] - Max wait time
 * @returns {object} { selected, previousValue, confirmedValue }
 */
async function pick(page, params) {
  const { inputSelector, dropdownSelector, value, timeout = 10000 } = params;

  // Step 1: Find and click the input to focus
  const input = page.locator(inputSelector).first();
  await input.waitFor({ state: 'visible', timeout });
  const previousValue = await input.inputValue() || '';
  await input.click({ timeout });

  // Step 2: Clear and type the filter text
  await input.fill(value);

  // Step 3: Wait for dropdown to appear
  const dropdown = page.locator(dropdownSelector).first();
  await dropdown.waitFor({ state: 'visible', timeout });

  // Step 4: Find the matching option — use :text-is() for exact match
  const option = dropdown.locator(`li:text-is('${value}')`).first();

  if (await option.count() === 0) {
    // Try substring match as fallback
    const substringOption = dropdown.locator(`li:has-text('${value}')`).first();
    if (await substringOption.count() > 0) {
      // Use JS dispatch for Telerik compatibility
      await substringOption.evaluate((el) => {
        el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        el.click();
      });
    } else {
      // List available options for error reporting
      const allOptions = dropdown.locator('li');
      const count = await allOptions.count();
      const available = [];
      for (let i = 0; i < Math.min(count, 20); i++) {
        const text = await allOptions.nth(i).textContent();
        if (text) available.push(text.trim());
      }
      throw new Error(`Telerik ComboBox: option "${value}" not found. Available: ${available.join(', ')}`);
    }
  } else {
    // Use JS dispatch for Telerik compatibility (mousedown + click)
    await option.evaluate((el) => {
      el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      el.click();
    });
  }

  // Step 5: Verify selection
  await page.waitForTimeout(300);
  const confirmedValue = await input.inputValue() || '';

  return {
    selected: value,
    previousValue: previousValue.trim(),
    confirmedValue: confirmedValue.trim(),
  };
}

/**
 * Read the current value of a Telerik RadComboBox.
 */
async function read(page, params) {
  const { inputSelector, timeout = 5000 } = params;
  const input = page.locator(inputSelector).first();
  await input.waitFor({ state: 'visible', timeout });
  return (await input.inputValue() || '').trim();
}

module.exports = { pick, read };
