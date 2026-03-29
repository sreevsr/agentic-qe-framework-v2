/**
 * SCOUT v2 — Application Element Discovery Tool
 * ================================================
 *
 * YOU drive the browser. Scout records elements when YOU click Scan.
 *
 * Capabilities:
 *   - 7 UI library families: Fluent UI v8/v9, MUI, Ant Design, PrimeNG, Bootstrap, Kendo UI + ARIA fallback
 *   - 40+ component patterns with interaction method mapping
 *   - Full iframe probing (navigates into iframes, scans DOM, returns)
 *   - Two-pass scanner (Pass 1: DOM attributes instant, Pass 2: async bounding boxes)
 *   - Hit-area mismatch detection for dropdowns/comboboxes
 *   - Noise filtering (hidden, tiny, duplicate, decorative)
 *   - Selector priority: data-testid → data-automation-id → id → role+aria → class → tag
 *   - In-page floating toolbar (draggable) — replaces Terminal 2 from v1
 *   - Output: locator JSON files per page (direct input for Builder agent)
 *
 * How to run:
 *   cd output
 *   npx playwright test tools/scout.spec.ts --headed
 *
 * Controls (floating toolbar in browser):
 *   Scan     = capture current page elements immediately
 *   Timed 5s = 5-second countdown then capture (for tooltips, hover elements)
 *   Done     = finalize, generate locator JSONs, close browser
 *
 * Output:
 *   output/locators/{page-name}.locators.json   (one per scanned page)
 *   output/scout-reports/{app}-page-inventory.json
 */

import { test, Page, Frame } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// CONFIGURATION
// ============================================================================

const CFG = {
  startUrl: process.env.BASE_URL || 'http://localhost:3000',
  appName: process.env.SCOUT_APP_NAME || 'app',
  locatorsDir: path.join('.', 'locators'),
  scoutReportsDir: path.join('.', 'scout-reports'),
  toolbarScript: path.join('.', 'tools', 'scout-toolbar.js'),
  pageLoadTimeout: 30000,
  pollInterval: 500,
  sessionTimeout: 1800000,   // 30 min max session
  boundingBoxTimeout: 300,
};

// ============================================================================
// LIBRARY DETECTION PATTERNS (7 libraries)
// ============================================================================

const LIB_PATTERNS: { prefix: RegExp; name: string }[] = [
  { prefix: /\bfui-/, name: 'Fluent UI v9' },
  { prefix: /\bms-/, name: 'Fluent UI v8' },
  { prefix: /\bMui/, name: 'Material UI' },
  { prefix: /\bant-/, name: 'Ant Design' },
  { prefix: /\bp-(?:dropdown|button|datatable|dialog)/, name: 'PrimeNG' },
  { prefix: /\b(?:btn-|form-control|form-select|modal-dialog|nav-tabs)/, name: 'Bootstrap' },
  { prefix: /\bk-(?:dropdown|grid|button|dialog|combobox)/, name: 'Kendo UI' },
];

function detectLib(classes: string[]): string {
  const classStr = classes.join(' ');
  for (const lib of LIB_PATTERNS) {
    if (lib.prefix.test(classStr)) return lib.name;
  }
  return '';
}

// ============================================================================
// COMPONENT TYPE CLASSIFICATION (40+ patterns across 7 libraries)
// ============================================================================

interface ComponentDef {
  pattern: RegExp;
  type: string;
  category: string;
  method: string;
  interaction: string;
}

const COMPONENT_MAP: ComponentDef[] = [
  // Fluent UI v9 (fui- prefix)
  { pattern: /fui-Combobox/, type: 'Fluent UI v9 Combobox', category: 'dropdown', method: 'fluentComboBoxSelect', interaction: 'Click chevron [role="button"] → wait [role="listbox"] → click [role="option"]' },
  { pattern: /fui-Dropdown/, type: 'Fluent UI v9 Dropdown', category: 'dropdown', method: 'fluentDropdownSelect', interaction: 'Click trigger → wait [role="listbox"] → click [role="option"]' },
  { pattern: /fui-Dialog/, type: 'Fluent UI v9 Dialog', category: 'modal', method: 'waitForDialog', interaction: 'Wait [role="dialog"] → close via button or Escape' },
  { pattern: /fui-DataGrid/, type: 'Fluent UI v9 DataGrid', category: 'grid', method: 'fluentGridClick', interaction: 'Rows: [role="row"], cells: [role="gridcell"]' },
  { pattern: /fui-Tab/, type: 'Fluent UI v9 Tab', category: 'tab', method: 'click', interaction: 'Click [role="tab"] matching name' },
  { pattern: /fui-Menu/, type: 'Fluent UI v9 Menu', category: 'navigation', method: 'click', interaction: 'Click [role="menuitem"] matching name' },
  { pattern: /fui-Input/, type: 'Fluent UI v9 Input', category: 'input', method: 'fill', interaction: 'Fill input element directly' },
  { pattern: /fui-Checkbox/, type: 'Fluent UI v9 Checkbox', category: 'input', method: 'click', interaction: 'Click [role="checkbox"]' },
  { pattern: /fui-Switch/, type: 'Fluent UI v9 Switch', category: 'input', method: 'click', interaction: 'Click [role="switch"]' },
  { pattern: /fui-Button/, type: 'Fluent UI v9 Button', category: 'button', method: 'click', interaction: 'Click button directly' },
  { pattern: /fui-Textarea/, type: 'Fluent UI v9 Textarea', category: 'input', method: 'fill', interaction: 'Fill textarea directly' },
  { pattern: /fui-SpinButton/, type: 'Fluent UI v9 SpinButton', category: 'input', method: 'fill', interaction: 'Fill input or click increment/decrement' },
  { pattern: /fui-Slider/, type: 'Fluent UI v9 Slider', category: 'input', method: 'click', interaction: 'Click [role="slider"] or drag' },

  // Fluent UI v8 (ms- prefix)
  { pattern: /ms-ComboBox(?!-option)/, type: 'Fluent UI ComboBox', category: 'dropdown', method: 'fluentComboBoxSelect', interaction: 'Click button.ms-ComboBox-CaretDown-button → wait .ms-Callout [role="option"] → click option' },
  { pattern: /ms-Dropdown/, type: 'Fluent UI Dropdown', category: 'dropdown', method: 'fluentDropdownSelect', interaction: 'Click div.ms-Dropdown → wait [role="listbox"] → click [role="option"]' },
  { pattern: /ms-ContextualMenu/, type: 'Fluent UI ContextualMenu', category: 'dropdown', method: 'fluentContextMenuSelect', interaction: 'Click trigger → wait [role="menu"] → getByRole("menuitem")' },
  { pattern: /ms-DetailsList/, type: 'Fluent UI DetailsList', category: 'grid', method: 'fluentGridClick', interaction: 'Rows: [role="row"], cells: [role="gridcell"]' },
  { pattern: /ms-Panel/, type: 'Fluent UI Panel', category: 'modal', method: 'waitForPanel', interaction: 'Wait .ms-Panel or [role="dialog"] → close: button[aria-label="Close"]' },
  { pattern: /ms-Modal|ms-Dialog/, type: 'Fluent UI Modal/Dialog', category: 'modal', method: 'waitForDialog', interaction: 'Wait [role="dialog"] → close: button[aria-label="Close"] or Escape' },
  { pattern: /ms-Nav\b/, type: 'Fluent UI Nav', category: 'navigation', method: 'click', interaction: 'Click a.ms-Nav-link:has-text("Link Name")' },
  { pattern: /ms-Pivot/, type: 'Fluent UI Pivot', category: 'tab', method: 'click', interaction: 'Click button.ms-Pivot-link:has-text("Tab Name")' },
  { pattern: /ms-CommandBar/, type: 'Fluent UI CommandBar', category: 'navigation', method: 'click', interaction: 'Click button.ms-CommandBarItem-link:has-text("Command")' },
  { pattern: /ms-SearchBox/, type: 'Fluent UI SearchBox', category: 'input', method: 'fill', interaction: 'Fill input.ms-SearchBox-field' },
  { pattern: /ms-TextField/, type: 'Fluent UI TextField', category: 'input', method: 'fill', interaction: 'Fill input.ms-TextField-field' },
  { pattern: /ms-Toggle/, type: 'Fluent UI Toggle', category: 'input', method: 'click', interaction: 'Click button.ms-Toggle-button' },
  { pattern: /ms-Checkbox/, type: 'Fluent UI Checkbox', category: 'input', method: 'click', interaction: 'Click input.ms-Checkbox-input or label.ms-Checkbox-label' },
  { pattern: /ms-Button/, type: 'Fluent UI Button', category: 'button', method: 'click', interaction: 'Click button.ms-Button' },
  { pattern: /ms-Callout/, type: 'Fluent UI Callout', category: 'modal', method: 'waitForDialog', interaction: 'Wait .ms-Callout → interact with contents' },
  { pattern: /ms-DatePicker/, type: 'Fluent UI DatePicker', category: 'input', method: 'fill', interaction: 'Fill input or click calendar icon → select date' },

  // Material UI (MUI)
  { pattern: /MuiSelect/, type: 'MUI Select', category: 'dropdown', method: 'muiSelectOption', interaction: 'Click .MuiSelect-select → wait [role="listbox"] → click [role="option"]' },
  { pattern: /MuiAutocomplete/, type: 'MUI Autocomplete', category: 'dropdown', method: 'muiAutocompleteSelect', interaction: 'Fill input → wait .MuiAutocomplete-popper → click option' },
  { pattern: /MuiDialog/, type: 'MUI Dialog', category: 'modal', method: 'waitForDialog', interaction: 'Wait [role="dialog"] → close via button' },
  { pattern: /MuiDrawer/, type: 'MUI Drawer', category: 'modal', method: 'waitForPanel', interaction: 'Wait .MuiDrawer-root → close via button or backdrop' },
  { pattern: /MuiDataGrid/, type: 'MUI DataGrid', category: 'grid', method: 'click', interaction: 'Rows: .MuiDataGrid-row, cells: .MuiDataGrid-cell' },
  { pattern: /MuiTab\b/, type: 'MUI Tab', category: 'tab', method: 'click', interaction: 'Click [role="tab"] matching name' },
  { pattern: /MuiTextField/, type: 'MUI TextField', category: 'input', method: 'fill', interaction: 'Fill .MuiInputBase-input' },
  { pattern: /MuiButton/, type: 'MUI Button', category: 'button', method: 'click', interaction: 'Click .MuiButton-root' },

  // Ant Design
  { pattern: /ant-select/, type: 'Ant Design Select', category: 'dropdown', method: 'antSelectOption', interaction: 'Click .ant-select-selector → wait .ant-select-dropdown → click .ant-select-item' },
  { pattern: /ant-modal/, type: 'Ant Design Modal', category: 'modal', method: 'waitForDialog', interaction: 'Wait .ant-modal → close .ant-modal-close' },
  { pattern: /ant-drawer/, type: 'Ant Design Drawer', category: 'modal', method: 'waitForPanel', interaction: 'Wait .ant-drawer → close .ant-drawer-close' },
  { pattern: /ant-table/, type: 'Ant Design Table', category: 'grid', method: 'click', interaction: 'Rows: .ant-table-row, cells: .ant-table-cell' },
  { pattern: /ant-menu/, type: 'Ant Design Menu', category: 'navigation', method: 'click', interaction: 'Click .ant-menu-item:has-text("Item")' },
  { pattern: /ant-tabs/, type: 'Ant Design Tabs', category: 'tab', method: 'click', interaction: 'Click .ant-tabs-tab:has-text("Tab Name")' },
  { pattern: /ant-input/, type: 'Ant Design Input', category: 'input', method: 'fill', interaction: 'Fill .ant-input' },
  { pattern: /ant-btn/, type: 'Ant Design Button', category: 'button', method: 'click', interaction: 'Click .ant-btn' },
  { pattern: /ant-tree/, type: 'Ant Design Tree', category: 'navigation', method: 'click', interaction: 'Click .ant-tree-treenode' },
  { pattern: /ant-cascader/, type: 'Ant Design Cascader', category: 'dropdown', method: 'click', interaction: 'Click .ant-cascader-picker → select cascading options' },

  // PrimeNG / PrimeReact
  { pattern: /p-dropdown/, type: 'PrimeNG Dropdown', category: 'dropdown', method: 'primeDropdownSelect', interaction: 'Click .p-dropdown → wait .p-dropdown-panel → click .p-dropdown-item' },
  { pattern: /p-datatable/, type: 'PrimeNG DataTable', category: 'grid', method: 'click', interaction: 'Rows: .p-datatable-tbody tr' },
  { pattern: /p-dialog/, type: 'PrimeNG Dialog', category: 'modal', method: 'waitForDialog', interaction: 'Wait .p-dialog → close .p-dialog-header-close' },
  { pattern: /p-button/, type: 'PrimeNG Button', category: 'button', method: 'click', interaction: 'Click .p-button' },
  { pattern: /p-multiselect/, type: 'PrimeNG MultiSelect', category: 'dropdown', method: 'click', interaction: 'Click .p-multiselect → wait .p-multiselect-panel → click items' },
  { pattern: /p-autocomplete/, type: 'PrimeNG AutoComplete', category: 'dropdown', method: 'fill', interaction: 'Fill .p-autocomplete-input → wait .p-autocomplete-panel → click item' },

  // Bootstrap
  { pattern: /dropdown-toggle/, type: 'Bootstrap Dropdown', category: 'dropdown', method: 'click', interaction: 'Click .dropdown-toggle → wait .dropdown-menu.show → click .dropdown-item' },
  { pattern: /modal-dialog/, type: 'Bootstrap Modal', category: 'modal', method: 'waitForDialog', interaction: 'Wait .modal.show → close [data-bs-dismiss="modal"]' },
  { pattern: /nav-tabs/, type: 'Bootstrap Tabs', category: 'tab', method: 'click', interaction: 'Click .nav-link' },
  { pattern: /form-select/, type: 'Bootstrap Select', category: 'dropdown', method: 'selectOption', interaction: 'page.selectOption() — native select' },
  { pattern: /form-control/, type: 'Bootstrap Input', category: 'input', method: 'fill', interaction: 'Fill .form-control' },

  // Kendo UI
  { pattern: /k-combobox/, type: 'Kendo ComboBox', category: 'dropdown', method: 'kendoDropdownSelect', interaction: 'Click .k-combobox → wait .k-popup → click .k-list-item' },
  { pattern: /k-dropdown/, type: 'Kendo Dropdown', category: 'dropdown', method: 'kendoDropdownSelect', interaction: 'Click .k-dropdown → wait .k-popup → click .k-list-item' },
  { pattern: /k-grid/, type: 'Kendo Grid', category: 'grid', method: 'click', interaction: 'Rows: tr.k-master-row' },
  { pattern: /k-dialog|k-window/, type: 'Kendo Dialog', category: 'modal', method: 'waitForDialog', interaction: 'Wait .k-dialog → close .k-dialog-close' },
  { pattern: /k-button/, type: 'Kendo Button', category: 'button', method: 'click', interaction: 'Click .k-button' },
  { pattern: /k-datepicker/, type: 'Kendo DatePicker', category: 'input', method: 'fill', interaction: 'Fill .k-dateinput-wrap input or click .k-select → pick date' },
];

function detectComponent(el: { classes: string[]; tag: string; role: string | null }): { type: string; category: string; method: string; interaction: string | null } {
  const classStr = el.classes.join(' ');
  for (const comp of COMPONENT_MAP) {
    if (comp.pattern.test(classStr)) {
      return { type: comp.type, category: comp.category, method: comp.method, interaction: comp.interaction };
    }
  }
  // ARIA / semantic fallback
  if (el.role === 'combobox') return { type: 'ComboBox (generic)', category: 'dropdown', method: 'click', interaction: 'Click → wait options → select' };
  if (el.role === 'grid' || el.role === 'treegrid') return { type: 'Data Grid', category: 'grid', method: 'click', interaction: 'Rows: [role="row"]' };
  if (el.role === 'dialog' || el.role === 'alertdialog') return { type: 'Dialog', category: 'modal', method: 'waitForDialog', interaction: 'Wait [role="dialog"] → close via button or Escape' };
  if (el.role === 'tablist') return { type: 'Tab List', category: 'tab', method: 'click', interaction: 'Click [role="tab"]' };
  if (el.role === 'navigation') return { type: 'Navigation', category: 'navigation', method: 'click', interaction: 'Click links within nav' };
  if (el.role === 'menu' || el.role === 'menubar') return { type: 'Menu', category: 'navigation', method: 'click', interaction: 'Click [role="menuitem"]' };
  if (el.role === 'switch') return { type: 'Switch', category: 'input', method: 'click', interaction: 'Click [role="switch"]' };
  if (el.role === 'slider') return { type: 'Slider', category: 'input', method: 'click', interaction: 'Drag or click [role="slider"]' };
  if (el.tag === 'select') return { type: 'Native Select', category: 'dropdown', method: 'selectOption', interaction: 'page.selectOption()' };
  // Generic fallback
  if (el.tag === 'button' || el.role === 'button') return { type: 'Button', category: 'button', method: 'click', interaction: null };
  if (el.tag === 'input') return { type: 'Input', category: 'input', method: 'fill', interaction: null };
  if (el.tag === 'textarea') return { type: 'Textarea', category: 'input', method: 'fill', interaction: null };
  if (el.tag === 'a') return { type: 'Link', category: 'link', method: 'click', interaction: null };
  return { type: 'Unknown', category: 'other', method: 'click', interaction: null };
}

// ============================================================================
// SELECTOR GENERATION (priority chain with fallbacks)
// ============================================================================

function generateSelector(el: {
  dataTestId: string | null; dataAutomationId: string | null;
  id: string | null; role: string | null; ariaLabel: string | null;
  classes: string[]; tag: string;
}): string {
  if (el.dataTestId) return `[data-testid="${el.dataTestId}"]`;
  if (el.dataAutomationId) return `[data-automation-id="${el.dataAutomationId}"]`;
  if (el.id && !el.id.match(/^[0-9]/)) return `#${el.id}`;
  if (el.role && el.ariaLabel) return `[role="${el.role}"][aria-label="${el.ariaLabel}"]`;
  const compClass = el.classes.find(c => /^fui-|^ms-|^Mui|^ant-|^p-|^k-/.test(c) && !/--|__/.test(c));
  if (compClass) return `${el.tag}.${compClass}`;
  if (el.role) return `[role="${el.role}"]`;
  if (el.classes.length > 0) return `${el.tag}.${el.classes[0]}`;
  return el.tag;
}

function generateFallbacks(el: {
  dataTestId: string | null; dataAutomationId: string | null;
  id: string | null; role: string | null; ariaLabel: string | null;
  classes: string[]; tag: string; text: string;
}, primarySelector: string): string[] {
  const fallbacks: string[] = [];
  if (primarySelector !== `#${el.id}` && el.id && !el.id.match(/^[0-9]/)) fallbacks.push(`#${el.id}`);
  if (primarySelector !== `[data-testid="${el.dataTestId}"]` && el.dataTestId) fallbacks.push(`[data-testid="${el.dataTestId}"]`);
  if (el.role && el.ariaLabel && primarySelector !== `[role="${el.role}"][aria-label="${el.ariaLabel}"]`) fallbacks.push(`[role="${el.role}"][aria-label="${el.ariaLabel}"]`);
  if (el.text && el.tag) fallbacks.push(`${el.tag}:has-text("${el.text.substring(0, 40)}")`);
  return fallbacks.slice(0, 3);
}

// ============================================================================
// ELEMENT NAME GENERATION (camelCase from selector or text)
// ============================================================================

function generateElementName(el: {
  dataTestId: string | null; dataAutomationId: string | null;
  id: string | null; ariaLabel: string | null; text: string;
  tag: string; role: string | null;
}, category: string): string {
  // Prefer data-testid as name source
  const raw = el.dataTestId || el.dataAutomationId || el.id || el.ariaLabel || el.text || '';
  if (!raw) return `${category}${el.tag}`;

  // Convert to camelCase: "Photo Status" → "photoStatus", "search-btn" → "searchBtn"
  return raw
    .replace(/[^a-zA-Z0-9\s-_]/g, '')
    .trim()
    .substring(0, 40)
    .split(/[\s\-_]+/)
    .map((word, i) => i === 0 ? word.toLowerCase() : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
}

// ============================================================================
// INTERACTIVE ELEMENT SELECTORS
// ============================================================================

const INTERACTIVE_SELECTORS = [
  'button', 'a[href]', 'input', 'select', 'textarea',
  '[role="button"]', '[role="combobox"]', '[role="listbox"]',
  '[role="menu"]', '[role="menubar"]', '[role="menuitem"]',
  '[role="tab"]', '[role="tablist"]', '[role="grid"]', '[role="treegrid"]',
  '[role="dialog"]', '[role="alertdialog"]',
  '[role="navigation"]', '[role="search"]',
  '[role="switch"]', '[role="slider"]',
  // Fluent UI v9
  '[class*="fui-Combobox"]', '[class*="fui-Dropdown"]', '[class*="fui-Button"]',
  '[class*="fui-Input"]', '[class*="fui-Dialog"]', '[class*="fui-DataGrid"]',
  '[class*="fui-Tab"]', '[class*="fui-Menu"]', '[class*="fui-Checkbox"]',
  '[class*="fui-Switch"]', '[class*="fui-Textarea"]', '[class*="fui-SpinButton"]',
  '[class*="fui-Slider"]',
  // Fluent UI v8
  '[class*="ms-ComboBox"]', '[class*="ms-Dropdown"]',
  '[class*="ms-Button"]', '[class*="ms-TextField"]',
  '[class*="ms-DetailsList"]', '[class*="ms-Pivot"]',
  '[class*="ms-ContextualMenu"]', '[class*="ms-Nav"]',
  '[class*="ms-Modal"]', '[class*="ms-Dialog"]',
  '[class*="ms-Panel"]', '[class*="ms-CommandBar"]',
  '[class*="ms-SearchBox"]', '[class*="ms-Toggle"]',
  '[class*="ms-Checkbox"]', '[class*="ms-Callout"]',
  '[class*="ms-DatePicker"]',
  // MUI
  '[class*="Mui"]',
  // Ant Design
  '[class*="ant-select"]', '[class*="ant-btn"]', '[class*="ant-input"]',
  '[class*="ant-table"]', '[class*="ant-modal"]', '[class*="ant-drawer"]',
  '[class*="ant-menu"]', '[class*="ant-tabs"]', '[class*="ant-tree"]',
  '[class*="ant-cascader"]',
  // PrimeNG
  '[class*="p-dropdown"]', '[class*="p-button"]', '[class*="p-datatable"]',
  '[class*="p-dialog"]', '[class*="p-multiselect"]', '[class*="p-autocomplete"]',
  // Bootstrap
  '[class*="btn-"]', '.form-control', '.form-select', '.dropdown-toggle',
  '.modal-dialog', '.nav-tabs',
  // Kendo
  '[class*="k-dropdown"]', '[class*="k-grid"]', '[class*="k-button"]',
  '[class*="k-dialog"]', '[class*="k-combobox"]', '[class*="k-datepicker"]',
  // Generic
  '[onclick]', '[data-testid]', '[data-automation-id]',
  '[aria-haspopup]', '[aria-expanded]',
].join(',');

// ============================================================================
// RAW ELEMENT INTERFACE
// ============================================================================

interface RawElement {
  tag: string;
  classes: string[];
  id: string | null;
  role: string | null;
  ariaLabel: string | null;
  ariaHasPopup: string | null;
  dataTestId: string | null;
  dataAutomationId: string | null;
  text: string;
  isHidden: boolean;
  hasZeroSize: boolean;
}

interface IframeInfo {
  src: string;
  id: string | null;
  name: string | null;
}

// ============================================================================
// TWO-PASS SCANNER (proven from v1)
// Pass 1: page.evaluate() — reads DOM attributes only (instant, no reflow)
// Pass 2: Playwright locator().boundingBox() — async CDP (non-blocking)
// ============================================================================

async function scanPage(target: Page | Frame, scanName: string): Promise<any> {
  const url = target.url();

  // Pass 1: Extract raw DOM data (no layout calculations)
  const { rawElements, iframes } = await target.evaluate((selectors: string) => {
    const seen = new Set<Element>();
    const results: any[] = [];

    document.querySelectorAll(selectors).forEach(el => {
      if (seen.has(el)) return;
      seen.add(el);

      const htmlEl = el as HTMLElement;
      const style = htmlEl.style;
      const isHidden = style.display === 'none' || style.visibility === 'hidden' ||
                       htmlEl.hidden || htmlEl.getAttribute('aria-hidden') === 'true';
      const hasZeroSize = htmlEl.offsetWidth < 5 && htmlEl.offsetHeight < 5;

      results.push({
        tag: htmlEl.tagName.toLowerCase(),
        classes: Array.from(htmlEl.classList),
        id: htmlEl.id || null,
        role: htmlEl.getAttribute('role'),
        ariaLabel: htmlEl.getAttribute('aria-label'),
        ariaHasPopup: htmlEl.getAttribute('aria-haspopup'),
        dataTestId: htmlEl.getAttribute('data-testid'),
        dataAutomationId: htmlEl.getAttribute('data-automation-id'),
        text: (htmlEl.textContent || '').trim().substring(0, 60),
        isHidden,
        hasZeroSize,
      });
    });

    const iframeData = Array.from(document.querySelectorAll('iframe')).map(f => ({
      src: f.src || '', id: f.id || null, name: f.name || null,
    }));

    return { rawElements: results, iframes: iframeData };
  }, INTERACTIVE_SELECTORS);

  // Noise filter: remove hidden, tiny, duplicates
  const seen = new Set<string>();
  const filtered: RawElement[] = [];
  for (const el of rawElements) {
    if (el.isHidden || el.hasZeroSize) continue;
    const key = `${el.tag}|${el.classes.join(',')}|${el.role}|${el.text.substring(0, 20)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    filtered.push(el);
  }

  // Pass 2: Async bounding box checks via Playwright (non-blocking)
  const elements: any[] = [];
  for (const el of filtered) {
    const lib = detectLib(el.classes);
    const comp = detectComponent(el);
    const selector = generateSelector(el);
    const fallbacks = generateFallbacks(el, selector);
    const elementName = generateElementName(el, comp.category);

    let boundingBox = null;
    let hitAreaWarning: string | null = null;
    try {
      const loc = target.locator(selector).first();
      const box = await loc.boundingBox({ timeout: CFG.boundingBoxTimeout });
      if (box && box.width > 0 && box.height > 0) {
        boundingBox = {
          x: Math.round(box.x), y: Math.round(box.y),
          width: Math.round(box.width), height: Math.round(box.height),
        };
      } else {
        continue;
      }
    } catch {
      continue;
    }

    // Hit-area mismatch detection for dropdowns/comboboxes
    if (el.ariaHasPopup || el.role === 'combobox') {
      try {
        const innerBtnLoc = target.locator(selector).first().locator('button, [role="button"]').first();
        const innerBox = await innerBtnLoc.boundingBox({ timeout: 200 });
        if (innerBox && boundingBox && innerBox.width < boundingBox.width * 0.3) {
          hitAreaWarning = `Inner button ${Math.round(innerBox.width)}x${Math.round(innerBox.height)}px inside ${boundingBox.width}x${boundingBox.height}px container`;
        }
      } catch { /* no inner button, fine */ }
    }

    elements.push({
      ...el,
      elementName,
      componentLibrary: lib,
      componentType: comp.type,
      category: comp.category,
      method: comp.method,
      interaction: comp.interaction,
      selector,
      fallbacks,
      boundingBox,
      hitAreaWarning,
    });
  }

  const libraries = [...new Set(elements.map(e => e.componentLibrary).filter(l => l !== ''))];

  return { pageName: scanName, url, elements, iframes, libraries };
}

// ============================================================================
// IFRAME PROBING
// ============================================================================

async function probeIframes(page: Page, parentScan: any): Promise<any[]> {
  const iframeScans: any[] = [];

  for (const iframe of parentScan.iframes) {
    if (!iframe.src || iframe.src === '' || iframe.src === 'about:blank' || iframe.src.startsWith('javascript:')) continue;

    const iframeName = iframe.id || iframe.name || iframe.src.split('/').pop()?.split('?')[0] || 'unnamed';
    console.log(`    Probing iframe: ${iframeName}`);

    try {
      const frame = page.frames().find(f =>
        f.url() === iframe.src || f.url().startsWith(iframe.src) ||
        (iframe.id && f.name() === iframe.id) || (iframe.name && f.name() === iframe.name)
      );

      if (!frame) {
        console.log(`    IFRAME NOT FOUND: ${iframe.src}`);
        iframeScans.push({ pageName: `${parentScan.pageName}-iframe-${iframeName}`, url: iframe.src, elements: [], iframes: [], libraries: [], error: 'Frame not loaded' });
        continue;
      }

      const iframeScan = await scanPage(frame, `${parentScan.pageName}-iframe-${iframeName}`);
      iframeScans.push(iframeScan);
    } catch (err) {
      console.log(`    IFRAME BLOCKED: ${iframe.src}`);
      iframeScans.push({ pageName: `${parentScan.pageName}-iframe-${iframeName}`, url: iframe.src, elements: [], iframes: [], libraries: [], error: String(err) });
    }
  }

  return iframeScans;
}

// ============================================================================
// LOCATOR JSON GENERATOR — Produces output/locators/{page-name}.locators.json
// ============================================================================

function generateLocatorJson(scan: any): Record<string, any> {
  const locators: Record<string, any> = {};
  const usedNames = new Set<string>();

  for (const el of scan.elements) {
    // Ensure unique name
    let name = el.elementName;
    if (usedNames.has(name)) {
      let suffix = 2;
      while (usedNames.has(`${name}${suffix}`)) suffix++;
      name = `${name}${suffix}`;
    }
    usedNames.add(name);

    const entry: any = {
      primary: el.selector,
      fallbacks: el.fallbacks,
      type: el.category,
    };

    if (el.componentLibrary) {
      entry.componentLibrary = el.componentLibrary;
    }
    if (el.interaction) {
      entry.interactionNotes = el.interaction;
    }
    if (el.hitAreaWarning) {
      entry.hitAreaWarning = el.hitAreaWarning;
    }

    locators[name] = entry;
  }

  return locators;
}

// ============================================================================
// FEASIBILITY DATA GENERATOR — Raw metrics for automation feasibility report
// ============================================================================

function generateFeasibilityData(scans: any[], appName: string): Record<string, any> {
  const allElements = scans.flatMap(s => s.elements || []);
  const allIframes = scans.flatMap(s => s.iframes || []);
  const allLibraries = [...new Set(scans.flatMap(s => s.libraries || []))];

  // Selector stability breakdown
  const withDataTestId = allElements.filter((e: any) => e.dataTestId).length;
  const withDataAutomationId = allElements.filter((e: any) => e.dataAutomationId).length;
  const withId = allElements.filter((e: any) => e.id && !e.dataTestId && !e.dataAutomationId).length;
  const withRoleAndLabel = allElements.filter((e: any) => e.role && e.ariaLabel && !e.dataTestId && !e.dataAutomationId && !e.id).length;
  const classOnly = allElements.length - withDataTestId - withDataAutomationId - withId - withRoleAndLabel;
  const stableCount = withDataTestId + withDataAutomationId + withId + withRoleAndLabel;
  const stablePercentage = allElements.length > 0 ? Math.round((stableCount / allElements.length) * 100) : 0;

  // Accessibility readiness
  const withAriaRole = allElements.filter((e: any) => e.role).length;
  const withAriaLabel = allElements.filter((e: any) => e.ariaLabel).length;
  const semanticHtml = allElements.filter((e: any) => ['button', 'a', 'input', 'select', 'textarea'].includes(e.tag)).length;
  const accessibilityScore = allElements.length > 0 ? Math.round((withAriaRole / allElements.length) * 100) : 0;

  // Component complexity
  const categories: Record<string, number> = {};
  for (const el of allElements) {
    categories[el.category] = (categories[el.category] || 0) + 1;
  }
  const nativeHtml = allElements.filter((e: any) => !e.componentLibrary).length;
  const libraryComponents = allElements.filter((e: any) => e.componentLibrary).length;

  // Risk indicators
  const hitAreaMismatches = allElements.filter((e: any) => e.hitAreaWarning).length;
  const iframesTotal = allIframes.length;
  const iframesBlocked = scans.filter(s => s.error && s.error.includes('BLOCKED')).length;
  const customDropdowns = allElements.filter((e: any) => e.category === 'dropdown' && e.componentLibrary).length;
  const nativeDropdowns = allElements.filter((e: any) => e.category === 'dropdown' && !e.componentLibrary).length;

  // Per-page summary
  const pageSummaries = scans.map(s => ({
    name: s.pageName,
    url: s.url,
    elements: s.elements?.length || 0,
    libraries: s.libraries || [],
    dropdowns: s.elements?.filter((e: any) => e.category === 'dropdown').length || 0,
    modals: s.elements?.filter((e: any) => e.category === 'modal').length || 0,
    grids: s.elements?.filter((e: any) => e.category === 'grid').length || 0,
    inputs: s.elements?.filter((e: any) => e.category === 'input').length || 0,
    buttons: s.elements?.filter((e: any) => e.category === 'button').length || 0,
    links: s.elements?.filter((e: any) => e.category === 'link').length || 0,
    iframes: s.iframes?.length || 0,
    hitAreaMismatches: s.elements?.filter((e: any) => e.hitAreaWarning).length || 0,
    stableSelectors: s.elements?.filter((e: any) => e.dataTestId || e.dataAutomationId || e.id || (e.role && e.ariaLabel)).length || 0,
  }));

  return {
    app: appName,
    assessedAt: new Date().toISOString(),
    summary: {
      totalPages: scans.length,
      totalElements: allElements.length,
      libraries: allLibraries,
      selectorStabilityPercentage: stablePercentage,
      accessibilityReadinessPercentage: accessibilityScore,
    },
    selectorStability: {
      dataTestId: withDataTestId,
      dataAutomationId: withDataAutomationId,
      idAttribute: withId,
      roleWithAriaLabel: withRoleAndLabel,
      classOrTagOnly: classOnly,
      totalStable: stableCount,
      totalFragile: classOnly,
      stablePercentage,
    },
    accessibility: {
      elementsWithAriaRole: withAriaRole,
      elementsWithAriaLabel: withAriaLabel,
      semanticHtmlElements: semanticHtml,
      accessibilityPercentage: accessibilityScore,
    },
    componentComplexity: {
      nativeHtml,
      libraryComponents,
      libraries: allLibraries,
      categoryCounts: categories,
      customDropdowns,
      nativeDropdowns,
    },
    riskIndicators: {
      hitAreaMismatches,
      iframesTotal,
      iframesBlocked,
      customDropdowns,
      pagesWithNoStableSelectors: pageSummaries.filter(p => p.stableSelectors === 0).map(p => p.name),
    },
    perPage: pageSummaries,
  };
}

// ============================================================================
// APP-CONTEXT GENERATOR — Produces scenarios/app-contexts/{app}.md
// ============================================================================

function generateAppContext(scans: any[], appName: string, startUrl: string): string {
  const allLibraries = [...new Set(scans.flatMap(s => s.libraries || []))];
  const allElements = scans.flatMap(s => s.elements || []);
  const timestamp = new Date().toISOString().split('T')[0];

  let ctx = `# App-Context: ${appName}\n\n`;
  ctx += `## Application Overview\n`;
  ctx += `- **URL:** ${startUrl}\n`;
  ctx += `- **Type:** Web application\n`;
  ctx += `- **Framework:** ${allLibraries.length > 0 ? allLibraries.join(', ') : 'Native HTML / Unknown'}\n`;
  ctx += `- **Scanned:** ${timestamp}\n\n`;
  ctx += `---\n\n`;

  // Known page structure
  ctx += `## Known Page Structure\n`;
  for (const scan of scans) {
    if (scan.error) continue;
    const elCount = scan.elements?.length || 0;
    const dd = scan.elements?.filter((e: any) => e.category === 'dropdown').length || 0;
    const md = scan.elements?.filter((e: any) => e.category === 'modal').length || 0;
    const gr = scan.elements?.filter((e: any) => e.category === 'grid').length || 0;
    const inp = scan.elements?.filter((e: any) => e.category === 'input').length || 0;

    ctx += `- **${scan.pageName}** (${scan.url}): ${elCount} elements`;
    const parts: string[] = [];
    if (inp > 0) parts.push(`${inp} inputs`);
    if (dd > 0) parts.push(`${dd} dropdowns`);
    if (md > 0) parts.push(`${md} modals`);
    if (gr > 0) parts.push(`${gr} grids`);
    if (parts.length > 0) ctx += ` (${parts.join(', ')})`;
    ctx += `\n`;
  }
  ctx += `\n---\n\n`;

  // Component library patterns
  if (allLibraries.length > 0) {
    ctx += `## UI Component Libraries Detected\n`;
    for (const lib of allLibraries) {
      const libElements = allElements.filter((e: any) => e.componentLibrary === lib);
      const types = [...new Set(libElements.map((e: any) => e.componentType))];
      ctx += `\n### ${lib}\n`;
      ctx += `- **Elements found:** ${libElements.length}\n`;
      ctx += `- **Component types:** ${types.join(', ')}\n`;

      // Include interaction patterns for complex components
      const complexComponents = libElements.filter((e: any) => e.interaction && (e.category === 'dropdown' || e.category === 'modal' || e.category === 'grid'));
      for (const comp of complexComponents) {
        ctx += `- **${comp.componentType}:** ${comp.interaction}\n`;
      }
    }
    ctx += `\n---\n\n`;
  }

  // Hit-area mismatches
  const mismatches = allElements.filter((e: any) => e.hitAreaWarning);
  if (mismatches.length > 0) {
    ctx += `## Known Issue: Hit-Area Mismatches\n`;
    for (const m of mismatches) {
      ctx += `- **${m.componentType}** (${m.selector}): ${m.hitAreaWarning}\n`;
    }
    ctx += `\n---\n\n`;
  }

  // Iframe notes
  const iframeScans = scans.filter(s => s.error);
  if (iframeScans.length > 0) {
    ctx += `## Known Issue: Iframes\n`;
    for (const ifs of iframeScans) {
      ctx += `- **${ifs.pageName}** (${ifs.url}): ${ifs.error}\n`;
    }
    ctx += `\n---\n\n`;
  }

  // Selector strategy recommendation
  const stableCount = allElements.filter((e: any) => e.dataTestId || e.dataAutomationId || e.id || (e.role && e.ariaLabel)).length;
  const stablePct = allElements.length > 0 ? Math.round((stableCount / allElements.length) * 100) : 0;

  ctx += `## Selector Strategy\n`;
  if (stablePct >= 70) {
    ctx += `- **Stability:** ${stablePct}% of elements have stable selectors (data-testid, id, role+aria-label)\n`;
    ctx += `- **Recommended approach:** Use data-testid as primary, id as fallback, role+aria-label as second fallback\n`;
  } else if (stablePct >= 40) {
    ctx += `- **Stability:** ${stablePct}% of elements have stable selectors — mixed stability\n`;
    ctx += `- **Recommended approach:** Use available data-testid/id where present. For class-only elements, use CSS attribute selectors with structural context. Consider requesting dev team to add data-testid attributes.\n`;
  } else {
    ctx += `- **Stability:** ${stablePct}% of elements have stable selectors — LOW stability\n`;
    ctx += `- **Recommended approach:** CSS attribute selectors with structural scoping. Role-based selectors where ARIA is present. Request dev team to add data-testid attributes for reliable automation.\n`;
  }

  return ctx;
}

// ============================================================================
// TOOLBAR COMMUNICATION — Poll window.__scoutAction via page.evaluate
// ============================================================================

async function waitForToolbarAction(page: Page): Promise<{ type: 'scan' | 'done'; name: string }> {
  return new Promise((resolve) => {
    const interval = setInterval(async () => {
      try {
        const result = await page.evaluate(() => {
          const action = (window as any).__scoutAction;
          const name = (window as any).__scoutPageName || '';
          if (action) {
            (window as any).__scoutAction = null;
            return { action, name };
          }
          return null;
        });

        if (result) {
          clearInterval(interval);
          if (result.action === 'DONE') {
            resolve({ type: 'done', name: 'done' });
          } else if (result.action === 'SCAN') {
            resolve({ type: 'scan', name: result.name || `page-${Date.now()}` });
          }
        }
      } catch {
        // Page might be navigating, retry on next poll
      }
    }, CFG.pollInterval);
  });
}

// ============================================================================
// TOOLBAR RE-INJECTION — After page navigation, toolbar disappears
// ============================================================================

async function injectToolbar(page: Page): Promise<void> {
  const toolbarExists = await page.evaluate(() => !!document.getElementById('scout-toolbar-root'));
  if (toolbarExists) return;

  const toolbarPath = path.resolve(CFG.toolbarScript);
  await page.addScriptTag({ path: toolbarPath });
}

// ============================================================================
// TEST — Interactive Scout Session
// ============================================================================

test.describe('Scout v2', () => {
  test('Interactive element discovery', async ({ page }) => {
    test.setTimeout(CFG.sessionTimeout);

    // Ensure output directories exist
    fs.mkdirSync(CFG.locatorsDir, { recursive: true });
    fs.mkdirSync(CFG.scoutReportsDir, { recursive: true });

    const allScans: any[] = [];
    let totalElements = 0;

    console.log('\n=========================================================');
    console.log('  SCOUT v2 — Application Element Discovery');
    console.log('=========================================================');
    console.log('  7 Libraries | 40+ Component Patterns | Iframe Probing');
    console.log('  Controls: Scan | Timed 5s | Done (floating toolbar)');
    console.log('=========================================================\n');

    // Navigate to app
    await page.goto(CFG.startUrl, { waitUntil: 'networkidle', timeout: CFG.pageLoadTimeout });
    console.log(`Browser open at: ${CFG.startUrl}`);

    // Inject floating toolbar
    await injectToolbar(page);
    console.log('Scout toolbar injected. Navigate the app and click Scan on the toolbar.\n');

    // Re-inject toolbar after each navigation (SPA or page load)
    page.on('load', async () => {
      try {
        await injectToolbar(page);
      } catch { /* page might be mid-navigation */ }
    });

    // Also handle SPA navigation (URL changes without full page load)
    let lastUrl = page.url();
    page.on('framenavigated', async (frame) => {
      if (frame === page.mainFrame() && page.url() !== lastUrl) {
        lastUrl = page.url();
        try {
          // Small delay for SPA content to render
          await page.waitForLoadState('domcontentloaded').catch(() => {});
          await injectToolbar(page);
        } catch { /* page might be mid-navigation */ }
      }
    });

    // Main loop: wait for toolbar actions
    while (true) {
      const action = await waitForToolbarAction(page);

      if (action.type === 'done') {
        console.log('\nDONE signal received. Generating locator files...\n');
        break;
      }

      if (action.type === 'scan') {
        const scanName = action.name;
        console.log(`Scanning: "${scanName}" — ${page.url()}`);

        try {
          const scan = await scanPage(page, scanName);
          allScans.push(scan);
          totalElements += scan.elements.length;

          console.log(`  Found ${scan.elements.length} interactive elements`);
          if (scan.libraries.length > 0) {
            console.log(`  Libraries: ${scan.libraries.join(', ')}`);
          }
          const dd = scan.elements.filter((e: any) => e.category === 'dropdown').length;
          const md = scan.elements.filter((e: any) => e.category === 'modal').length;
          const gr = scan.elements.filter((e: any) => e.category === 'grid').length;
          if (dd || md || gr) {
            console.log(`  Dropdowns: ${dd} | Modals: ${md} | Grids: ${gr}`);
          }

          // Probe iframes
          if (scan.iframes.length > 0) {
            console.log(`  Iframes detected: ${scan.iframes.length} — probing...`);
            const iframeScans = await probeIframes(page, scan);
            for (const ifs of iframeScans) {
              if (!ifs.error) {
                allScans.push(ifs);
                totalElements += ifs.elements.length;
                console.log(`  Iframe "${ifs.pageName}": ${ifs.elements.length} elements`);
              } else {
                console.log(`  Iframe "${ifs.pageName}": ${ifs.error}`);
              }
            }
          }

          // Hit-area warnings
          const warnings = scan.elements.filter((e: any) => e.hitAreaWarning);
          if (warnings.length > 0) {
            console.log(`  WARNING: ${warnings.length} hit-area mismatch(es)`);
          }

          // Write locator JSON immediately (incremental — each scan produces a file)
          const locatorJson = generateLocatorJson(scan);
          const locatorPath = path.join(CFG.locatorsDir, `${scanName}.locators.json`);

          if (fs.existsSync(locatorPath)) {
            // Merge with existing (user scanned same page again, e.g., with dropdown open)
            const existing = JSON.parse(fs.readFileSync(locatorPath, 'utf-8'));
            const merged = { ...existing, ...locatorJson };
            fs.writeFileSync(locatorPath, JSON.stringify(merged, null, 2), 'utf-8');
            console.log(`  Merged into existing: ${locatorPath}`);
          } else {
            fs.writeFileSync(locatorPath, JSON.stringify(locatorJson, null, 2), 'utf-8');
            console.log(`  Saved: ${locatorPath}`);
          }

          // Update toolbar stats
          await page.evaluate(
            ([pages, elements]: [number, number]) => {
              if ((window as any).__scoutUpdateStats) (window as any).__scoutUpdateStats(pages, elements);
            },
            [allScans.length, totalElements] as [number, number]
          );

          // Show scan complete message on toolbar
          await page.evaluate(
            (msg: string) => {
              if ((window as any).__scoutShowMessage) (window as any).__scoutShowMessage(msg, 3000);
            },
            `Captured ${scan.elements.length} elements from "${scanName}"`
          );

        } catch (err) {
          console.log(`  Scan failed: ${err}`);
        }

        console.log('');
      }
    }

    // Generate all outputs
    if (allScans.length > 0) {
      // 1. Page inventory JSON
      const inventory = {
        app: CFG.appName,
        scannedAt: new Date().toISOString(),
        pages: allScans.map(s => ({
          name: s.pageName,
          url: s.url,
          elements: s.elements.length,
          libraries: s.libraries,
          locatorFile: `${s.pageName}.locators.json`,
        })),
        totalPages: allScans.length,
        totalElements,
      };

      const inventoryPath = path.join(CFG.scoutReportsDir, `${CFG.appName}-page-inventory.json`);
      fs.writeFileSync(inventoryPath, JSON.stringify(inventory, null, 2), 'utf-8');

      // 2. Feasibility data JSON (raw metrics for LLM-generated report)
      const feasibilityData = generateFeasibilityData(allScans, CFG.appName);
      const feasibilityPath = path.join(CFG.scoutReportsDir, `${CFG.appName}-feasibility-data.json`);
      fs.writeFileSync(feasibilityPath, JSON.stringify(feasibilityData, null, 2), 'utf-8');

      // 3. App-context file (for Builder and Executor agents)
      const appContextDir = path.join('..', 'scenarios', 'app-contexts');
      fs.mkdirSync(appContextDir, { recursive: true });
      const appContextPath = path.join(appContextDir, `${CFG.appName}.md`);

      if (fs.existsSync(appContextPath)) {
        // Don't overwrite existing app-context — it may have learned patterns from prior runs
        console.log(`  App-context already exists: ${appContextPath} (preserved)`);
      } else {
        const appContext = generateAppContext(allScans, CFG.appName, CFG.startUrl);
        fs.writeFileSync(appContextPath, appContext, 'utf-8');
        console.log(`  App-context created: ${appContextPath}`);
      }

      console.log('=========================================================');
      console.log('  Scout Complete!');
      console.log(`  Pages scanned: ${allScans.length}`);
      console.log(`  Total elements: ${totalElements}`);
      console.log('');
      console.log('  Outputs:');
      console.log(`    Locator files:     ${CFG.locatorsDir}/`);
      console.log(`    Page inventory:    ${inventoryPath}`);
      console.log(`    Feasibility data:  ${feasibilityPath}`);
      console.log(`    App-context:       ${appContextPath}`);
      console.log('');
      console.log('  Next steps:');
      console.log('    1. Review locator JSONs in output/locators/');
      console.log('    2. Generate feasibility report: paste feasibility-data.json');
      console.log('       into Claude.ai with the prompt from tools/README.md');
      console.log('    3. Run your test scenarios through the pipeline');
      console.log('=========================================================\n');
    } else {
      console.log('\nNo scans captured.\n');
    }
  });
});
