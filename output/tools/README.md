# Scout — Application Element Discovery Tool

Scout is a one-time, user-driven tool that records every interactive element in your application. You navigate the app manually while Scout silently captures elements into locator JSON files. These files are then used by the Builder agent to generate test code — no browser exploration needed during code generation.

## When to Run Scout

- **First time** setting up automation for an application
- **After a major UI update** (new pages, redesigned components, new UI library)
- **When new pages/features are added** — run Scout on just the new sections, it adds to existing locator files

You do NOT need to re-run Scout for each test scenario. Scout maps the entire application once. All scenarios reuse the same locator files.

## Prerequisites

```bash
cd output
npm install
npx playwright install chromium
```

Ensure your `.env` file has `BASE_URL` and any credentials needed to access the app.

## How to Run

```bash
cd output
npx playwright test --config=tools/scout.config.ts
```

The `--headed` flag is required — you need to see and interact with the browser.

## How It Works

1. Scout opens a browser and navigates to your app's `BASE_URL`
2. A floating toolbar appears at the bottom-right of the page:

```
┌─────────────────────────────────────────┐
│  ≡ Scout Recording           ─         │
│  [Scan]  [Timed 5s]  [Done]            │
│  Pages: 0 | Elements: 0                │
└─────────────────────────────────────────┘
```

3. **You navigate the app manually** — log in, open pages, click through flows
4. At each page/state you want to record, click a button on the toolbar:

| Button | When to Use |
|--------|------------|
| **Scan** | Record the current page's elements immediately |
| **Timed 5s** | Start a 5-second countdown, then scan. Use for tooltips, hover menus, and elements that disappear when you move the mouse away. Hover over the element, click Timed, move mouse back to the element, wait for scan. |
| **Done** | Finish recording. Scout generates locator JSON files and closes the browser. |

5. The toolbar is **draggable** — grab the ≡ handle and move it if it overlaps an element you need to interact with.

## Tips for Complete Coverage

### Standard Pages
Navigate to each page in your app and click **Scan**. Scout captures all buttons, links, inputs, selects, checkboxes, and ARIA-role elements.

### Dropdowns (Kendo, Telerik, Fluent UI, custom)
Custom dropdowns render their options in a popup that only exists in the DOM when the dropdown is open:
1. Click the dropdown to open it
2. Click **Scan** while it's open (captures the popup options)
3. Close the dropdown and continue

### Tooltips and Hover Elements
Elements that appear on hover and disappear when mouse moves away:
1. Hover over the element so it appears
2. Click **Timed 5s** on the toolbar
3. Quickly move your mouse back to the tooltip/hover element
4. Wait — Scout scans after 5 seconds while the element is still visible

### Modals and Slide-Over Panels
1. Trigger the modal/panel (click the button that opens it)
2. Click **Scan** while it's open (captures modal content)
3. Close the modal and continue

### Dynamic Grids and Tables
1. Ensure the grid/table has loaded with data
2. Click **Scan** — captures column headers, row structure, action buttons
3. If the grid has expandable rows, expand one and click **Scan** again

### Filter Panels and Sidebars
1. Open the filter panel
2. Click **Scan** (captures filter controls)
3. If filters have sub-options (multi-select dropdowns), open those and scan separately

### iframes
Scout automatically detects iframes and scans their content when you click **Scan**. If an iframe loads lazily, make sure it's visible before scanning.

## Output

After clicking **Done**, Scout produces:

```
output/locators/
  ├── login-page.locators.json
  ├── dashboard-page.locators.json
  ├── user-photos-page.locators.json
  ├── filter-panel.locators.json
  ├── user-profile-modal.locators.json
  └── ...

output/scout-reports/
  └── {app-name}-page-inventory.json
```

### Locator JSON Format

Each locator file contains elements with primary selector, fallbacks, type, and interaction notes:

```json
{
  "searchButton": {
    "primary": "button[data-testid='search-btn']",
    "fallbacks": ["role=button[name='Search']", ".filter-panel .btn-search"],
    "type": "button"
  },
  "photoStatusDropdown": {
    "primary": "[data-role='dropdownlist'][aria-label='Photo Status']",
    "fallbacks": ["span.k-dropdown:has-text('Photo Status')"],
    "type": "select",
    "componentLibrary": "kendo",
    "interactionNotes": "Click to open popup, then click li.k-item with target text"
  }
}
```

### Page Inventory

A summary of all pages discovered with element counts:

```json
{
  "app": "unify-user-photos",
  "scannedAt": "2026-03-29T10:00:00Z",
  "pages": [
    { "name": "login-page", "url": "/login", "elements": 5 },
    { "name": "user-photos-page", "url": "/UserPhotos", "elements": 12 },
    { "name": "filter-panel", "url": "/UserPhotos", "elements": 8, "note": "panel on same URL" }
  ],
  "totalPages": 3,
  "totalElements": 25
}
```

## Output 3: Feasibility Data (for report generation)

Scout also produces raw automation feasibility metrics:

```
output/scout-reports/{app-name}-feasibility-data.json
```

This contains hard numbers — selector stability percentages, component complexity breakdown, risk indicators, accessibility readiness, per-page summaries. It is NOT a human-readable report — it's raw data for you to generate a polished report using Claude.ai (see below).

## Output 4: App-Context

Scout generates an app-context file used by the Builder and Executor agents:

```
scenarios/app-contexts/{app-name}.md
```

This contains: application overview, known page structure, UI library patterns, component interaction notes, hit-area mismatch warnings, iframe issues, and selector strategy recommendations. If an app-context already exists (from a prior pipeline run), Scout preserves it.

## Generating the Automation Feasibility Report

After Scout completes, use the feasibility data JSON to produce a customer-ready report. Open [Claude.ai](https://claude.ai) and paste the following prompt along with the contents of your `{app}-feasibility-data.json` file:

---

**Prompt for Claude.ai:**

```
You are a senior QE automation architect producing an Automation Feasibility Report
for an enterprise customer. Based on the raw feasibility data below, produce a
professional, customer-ready report in markdown format.

The report MUST include these sections:

1. **Executive Summary** — 3-4 sentences: app name, pages scanned, overall
   automation friendliness verdict (HIGH / MODERATE / LOW / AT RISK), key headline
   finding.

2. **Automation Friendliness Score** — Score 1-10 with justification. Base it on:
   - Selector stability percentage (>70% = good, 40-70% = moderate, <40% = poor)
   - Accessibility readiness (ARIA roles/labels coverage)
   - Component complexity (native HTML vs custom library controls)
   - Risk indicators (hit-area mismatches, blocked iframes, custom dropdowns)

3. **Selector Stability Analysis** — Breakdown table of selector types
   (data-testid, id, role+aria, class-only). Percentage of stable vs fragile.
   Specific recommendations for improving stability.

4. **Component Complexity Assessment** — Libraries detected, custom components
   requiring special handling (Kendo dropdowns, Fluent UI panels, etc.),
   interaction patterns that need non-standard approaches.

5. **Accessibility Readiness** — ARIA role coverage, semantic HTML usage,
   impact on selector strategy (good ARIA = more resilient selectors).

6. **Risk Register** — Table format:
   | Risk | Impact | Likelihood | Mitigation |
   Include: hit-area mismatches, blocked iframes, custom dropdowns, fragile
   selectors, dynamic content, session timeouts.

7. **Page-by-Page Assessment** — Table showing each page with element count,
   library, complexity rating (Simple/Moderate/Complex), and key concern.

8. **Recommendations for Development Team** — Specific, actionable items:
   - Which elements need data-testid attributes
   - Which ARIA roles/labels are missing
   - Which components need accessibility improvements

9. **Estimated Automation Effort** — Based on page count, element count, and
   complexity: estimated hours for initial automation, estimated maintenance
   effort per sprint.

10. **Conclusion** — Overall assessment: is this application ready for
    automation? What should be done before automation begins?

Tone: Professional, objective, data-driven. Suitable for a customer stakeholder
presentation. Include the raw numbers to support every claim.

Here is the feasibility data:

<paste contents of {app}-feasibility-data.json here>
```

---

## Page Naming

When you click **Scan**, Scout will prompt you for a page name in the terminal (e.g., `login-page`, `filter-panel`, `user-profile-modal`). Use kebab-case. If you scan the same page name twice, Scout merges the elements (useful for scanning a page before and after opening a dropdown).

## Re-Running Scout

- **New pages:** Run Scout again, navigate to the new pages only, scan them. Existing locator files are preserved.
- **Updated UI:** Delete the specific locator JSON file for the changed page, re-run Scout for that page.
- **Full re-scan:** Delete all files in `output/locators/` and `output/scout-reports/`, re-run Scout from scratch.

## Troubleshooting

| Issue | Solution |
|-------|---------|
| Toolbar overlaps an element | Drag the toolbar (≡ handle) to another corner |
| Element not captured | Make sure it's visible in the DOM — open dropdowns, expand sections, hover for tooltips (use Timed) |
| iframe elements missing | Scroll the iframe into view, ensure it's loaded, then Scan |
| App requires SSO/LDAP | Log in manually in the browser — Scout keeps the session. Scan pages after authentication. |
| Browser closes unexpectedly | Re-run Scout. Existing locator files on disk are preserved. |
