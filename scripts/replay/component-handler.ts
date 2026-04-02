/**
 * component-handler.ts — Detects UI component libraries and delegates
 * interactions to component-specific skills.
 *
 * Sits between the step handler and the element resolver. When a step
 * targets a known component (MUI Select, Ant Design Select, etc.),
 * this handler intercepts and uses the component-specific interaction
 * recipe instead of a generic click/select.
 *
 * Integration:
 *   step-handlers.ts calls tryComponentAction() before generic resolution.
 *   If it returns a result, the step is handled. If null, falls through
 *   to the normal resolver.
 */

import { Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

// Load the component detector (plain .js, never compiled by tsx)
const DETECTOR_SCRIPT = fs.readFileSync(
  path.join(__dirname, '..', '..', 'skills', 'replay', 'component-detector.js'),
  'utf-8',
);

// Load component skills lazily — only when actually needed
let muiSelect: any = null;
function getMuiSelect() {
  if (!muiSelect) {
    const skillPath = path.join(__dirname, '..', '..', 'skills', 'replay', 'mui-select.skill.js');
    if (!fs.existsSync(skillPath)) {
      throw new Error(`MUI Select skill not found: ${skillPath}`);
    }
    muiSelect = require(skillPath);
  }
  return muiSelect;
}

export interface ComponentActionResult {
  handled: boolean;
  evidence: string;
  capturedValues?: Record<string, any>;
}

/**
 * Try to handle a step action using component-specific skills.
 * Returns null if the target is not a known component (fall through to generic handler).
 */
export async function tryComponentAction(
  page: Page,
  verb: string,
  target: any,
  value?: string,
  timeout: number = 10000,
): Promise<ComponentActionResult | null> {
  // We need a CSS selector to detect the component
  const selector = extractSelector(target);
  if (!selector) return null;

  // Detect what component this is
  let detection: any;
  try {
    detection = await page.evaluate(
      `(${DETECTOR_SCRIPT})(${JSON.stringify({ selector })})`,
    );
  } catch {
    return null;
  }

  if (!detection) return null;

  // Route to the right component skill
  const { library, widget } = detection;

  // MUI Select
  if (library === 'mui' && widget === 'select') {
    if (verb === 'click' && !value) {
      // Plain click on a MUI Select — open it
      const wrapper = page.locator(detection.wrapperSelector).first();
      await wrapper.click({ timeout });
      return {
        handled: true,
        evidence: `MUI Select opened via wrapper (${detection.wrapperSelector})`,
      };
    }

    if (verb === 'select' || (verb === 'click' && value)) {
      // Select a value from MUI dropdown
      const result = await getMuiSelect().pick(page, {
        selector: detection.displaySelector || selector,
        value: value,
        timeout,
      });
      return {
        handled: true,
        evidence: `MUI Select: "${result.previousValue}" → "${result.selected}" (confirmed: "${result.confirmedValue}")`,
        capturedValues: { _lastSelected: result.confirmedValue },
      };
    }
  }

  // MUI IconButton — just click it, but use the detected wrapper
  if (library === 'mui' && widget === 'iconbutton') {
    if (verb === 'click') {
      const btn = page.locator(detection.wrapperSelector).first();
      await btn.click({ timeout });
      const label = detection.meta.title || detection.meta.ariaLabel || 'icon button';
      return {
        handled: true,
        evidence: `MUI IconButton clicked: ${label} (${detection.wrapperSelector})`,
      };
    }
  }

  // Ant Design Select
  if (library === 'antd' && widget === 'select') {
    if (verb === 'select' || verb === 'click') {
      const wrapper = page.locator(detection.wrapperSelector).first();
      await wrapper.click({ timeout });
      if (value) {
        const dropdown = page.locator(detection.meta.dropdownSelector).first();
        await dropdown.waitFor({ state: 'visible', timeout });
        const option = dropdown.locator(`${detection.meta.optionSelector}:has-text("${value}")`).first();
        await option.click({ timeout });
        return {
          handled: true,
          evidence: `Ant Design Select: selected "${value}"`,
        };
      }
      return { handled: true, evidence: `Ant Design Select opened` };
    }
  }

  // Kendo DropDownList
  if (library === 'kendo' && widget === 'select') {
    if (verb === 'select' || verb === 'click') {
      const wrapper = page.locator(detection.wrapperSelector).first();
      await wrapper.click({ timeout });
      if (value) {
        const popup = page.locator(detection.meta.dropdownSelector).first();
        await popup.waitFor({ state: 'visible', timeout });
        const option = popup.locator(`${detection.meta.optionSelector}:has-text("${value}")`).first();
        await option.click({ timeout });
        return {
          handled: true,
          evidence: `Kendo Select: selected "${value}"`,
        };
      }
      return { handled: true, evidence: `Kendo DropDownList opened` };
    }
  }

  // Fluent UI Dropdown
  if (library === 'fluent' && widget === 'select') {
    if (verb === 'select' || verb === 'click') {
      const wrapper = page.locator(detection.wrapperSelector).first();
      await wrapper.click({ timeout });
      if (value) {
        const listbox = page.locator(detection.meta.dropdownSelector).first();
        await listbox.waitFor({ state: 'visible', timeout });
        const option = listbox.locator(`${detection.meta.optionSelector}:has-text("${value}")`).first();
        await option.click({ timeout });
        return {
          handled: true,
          evidence: `Fluent UI Dropdown: selected "${value}"`,
        };
      }
      return { handled: true, evidence: `Fluent UI Dropdown opened` };
    }
  }

  // Known component but no handler for this verb/widget combo — log and fall through
  console.log(`       Component detected: ${library}/${widget} but no handler for verb="${verb}" — falling through to generic resolver`);
  return null;
}

/**
 * Extract a CSS selector from a target object.
 */
function extractSelector(target: any): string | null {
  if (!target) return null;
  if (target.css) return target.css;
  if (target.testId) return `[data-testid="${target.testId}"]`;
  if (target.id) return `#${target.id}`;
  // Can also try from fingerprint
  if (target._fingerprint) {
    if (target._fingerprint.id) return `#${target._fingerprint.id}`;
    if (target._fingerprint.cssPath) return target._fingerprint.cssPath;
  }
  return null;
}
