/**
 * DataGridCsvVerifier.helpers.ts — Team-owned helper that any scenario can
 * call via `USE_HELPER` to verify an exported CSV file's content matches the
 * data shown in the page's datagrid.
 *
 * Reads CSV → collects UI rows (paginated, per the chosen RowCollector) →
 * diffs them per the provided column mapping → attaches a structured JSON
 * report + a human-readable HTML diff + a console summary to the Playwright
 * test report → returns the DiffReport so the spec can assert on it.
 *
 * The actual diff and CSV-parse logic lives in framework utilities under
 * output/utils/ (csv-grid-compare.ts, grid-row-collector.ts). This file is
 * the @steps-walkable USE_HELPER entry point. It is app-agnostic — the
 * per-page specifics (column mapping, normalizers, pagination strategy)
 * come from the caller (scenario test-data JSON + chosen RowCollector).
 *
 * Per the framework convention (one repo per app), this lives directly under
 * output/pages/ — NOT output/pages/{app}/.
 *
 * ## Scenario usage
 *
 * ```markdown
 * 41. USE_HELPER: DataGridCsvVerifier.verifyExportedCsvMatchesGrid -> {{csvCompareResult}}
 * 42. VERIFY: {{csvCompareResult.ok}} is true
 * 43. REPORT: Compared {{csvCompareResult.rowsCompared}} rows with {{csvCompareResult.mismatches.length}} mismatches
 * ```
 *
 * ## Spec usage
 *
 * ```typescript
 * import { verifyExportedCsvMatchesGrid } from '../../pages/DataGridCsvVerifier.helpers';
 * import { singlePageCollector, clickNextCollector } from '../../utils/grid-row-collector';
 *
 * const result = await verifyExportedCsvMatchesGrid(page, {
 *   csvPath: downloadPath,                     // captured from the Export step
 *   rowCollector: singlePageCollector({        // OR clickNextCollector / infiniteScrollCollector / pageSizeMaxCollector
 *     headersSelector: 'thead th',
 *     rowsSelector: 'tbody tr',
 *   }),
 *   ...testData.csvCompare,                    // keyColumn, columnMap, ignore lists, customNormalizers
 * });
 * expect(result.ok).toBe(true);
 * ```
 */

import { type Page, type Download, test } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import {
  diffGridVsCsv,
  parseCsv,
  renderDiffHtml,
  renderDiffJson,
  renderDiffSummary,
  type CsvCompareConfig,
  type DiffReport,
} from '../utils/csv-grid-compare';
import { buildStableHeaderKeys, type RowCollector } from '../utils/grid-row-collector';

/**
 * Combined options: column mapping (CsvCompareConfig) + file path + collector.
 *
 * `keyColumn`, `columnMap`, `ignoreUiColumns`, `ignoreCsvColumns`, and
 * `customNormalizers` are inherited from CsvCompareConfig and typically come
 * from the scenario's test-data JSON (e.g. `...testData.csvCompare`).
 */
export interface VerifyExportedCsvOptions extends CsvCompareConfig {
  /** Absolute path to the downloaded CSV file. */
  csvPath: string;
  /**
   * UI row collection strategy. REQUIRED — no default, to force an explicit
   * pagination decision (silent undercounting on a paginated grid would be a
   * critical correctness bug).
   */
  rowCollector: RowCollector;
  /**
   * Base name for attached artifacts. Default 'csv-grid-diff' →
   * 'csv-grid-diff.json' + 'csv-grid-diff.html' in the Playwright report.
   */
  attachmentBaseName?: string;
}

/**
 * Verify a downloaded CSV exactly matches the data displayed in the page's
 * datagrid, per the column mapping passed in `opts`.
 *
 * Returns a structured DiffReport. The caller asserts on `report.ok` (or
 * `report.mismatches.length === 0`).
 *
 * @steps
 * 1. Read column headers and every data row from the datagrid using {{rowCollector}} (walks pagination if configured)
 * 2. Read every data row from the exported CSV file at {{csvPath}}
 * 3. VERIFY: Every UI column appears in columnMap or in ignoreUiColumns (hard fail with UnmappedColumnError otherwise)
 * 4. VERIFY: Every CSV column appears in columnMap or in ignoreCsvColumns (hard fail with UnmappedColumnError otherwise)
 * 5. FOR_EACH: row aligned by {{keyColumn}} — verify every mapped column value matches between the datagrid and the CSV after normalization
 * 6. REPORT: rowsCompared, mismatches, rowsInUiNotInCsv, rowsInCsvNotInUi
 * 7. ATTACH: a structured JSON diff and a human-readable HTML diff to the test report; emit a multi-line summary to the console
 * 8. CAPTURE: return the full DiffReport so the scenario can assert on {{result.ok}}
 */
export async function verifyExportedCsvMatchesGrid(
  page: Page,
  opts: VerifyExportedCsvOptions,
): Promise<DiffReport> {
  // ── Step 1 & 2: read both sides ─────────────────────────────────────
  if (!fs.existsSync(opts.csvPath)) {
    throw new Error(
      `[CSV-GRID] CSV file not found at "${opts.csvPath}". ` +
        `Ensure the Export step in the spec called download.saveAs(downloadPath) ` +
        `BEFORE this helper runs, and that downloadPath was captured correctly.`,
    );
  }
  const csvRaw = fs.readFileSync(opts.csvPath, 'utf-8');
  const csvRows = parseCsv(csvRaw);

  const { rows: uiRows } = await opts.rowCollector(page);

  // ── Steps 3–6: diff ─────────────────────────────────────────────────
  // Strip helper-specific options before passing to the pure differ.
  const { csvPath, rowCollector, attachmentBaseName, ...compareCfg } = opts;
  void csvPath;       // referenced via fs.readFileSync above; silence unused-var lint
  void rowCollector;  // already invoked above
  const report = diffGridVsCsv(uiRows, csvRows, compareCfg);

  // ── Step 7: attach reports ──────────────────────────────────────────
  const base = attachmentBaseName ?? 'csv-grid-diff';
  await test.info().attach(`${base}.json`, {
    body: renderDiffJson(report),
    contentType: 'application/json',
  });
  await test.info().attach(`${base}.html`, {
    body: renderDiffHtml(report),
    contentType: 'text/html',
  });
  // Console summary — visible in CI logs without opening the HTML report
  // eslint-disable-next-line no-console
  console.log(renderDiffSummary(report));

  // ── Step 8: return for spec assertion ───────────────────────────────
  return report;
}

// ─── capturePlaywrightCsvToProjectDownloads ────────────────────────────────

export interface CaptureCsvOptions {
  /**
   * Subdirectory inside the project root (process.cwd()) where the file is
   * saved. Default: `'downloads'` → `output/downloads/`. Created if missing.
   */
  downloadsDir?: string;
  /**
   * Override the saved filename. If omitted, uses `download.suggestedFilename()`
   * (typically the server-supplied name).
   */
  filenameOverride?: string;
}

export interface CapturedCsv {
  /** The filename component (no directory). */
  filename: string;
  /** Absolute path to the saved file. */
  path: string;
  /** The underlying Playwright Download handle (for advanced inspection). */
  download: Download;
}

/**
 * Run `triggerAction` (e.g. clicking the "Confirm download" button), capture
 * the resulting Playwright download event, and persist the file to a stable
 * project-local location so subsequent steps (and the CSV ⇄ grid verifier)
 * can read it. Without this, Playwright deletes the downloaded file from its
 * temp directory at end-of-test, which makes any post-download verification
 * impossible.
 *
 * The download is saved to `process.cwd()/downloads/<filename>` by default
 * (override via `opts.downloadsDir`). The function ALSO pushes a
 * `downloadPath` annotation onto the test report so later steps can recover
 * the path without sharing a closure variable.
 *
 * @example
 * ```typescript
 * const csv = await capturePlaywrightCsvToProjectDownloads(page, async () => {
 *   await invoicePage.clickExportConfirmYes();
 * });
 * expect(fs.existsSync(csv.path)).toBe(true);
 * // …later, hand csv.path to verifyExportedCsvMatchesGrid as `csvPath`.
 * ```
 */
export async function capturePlaywrightCsvToProjectDownloads(
  page: Page,
  triggerAction: () => Promise<void>,
  opts: CaptureCsvOptions = {},
): Promise<CapturedCsv> {
  const downloadPromise = page.waitForEvent('download');
  await triggerAction();
  const download = await downloadPromise;

  const filename = opts.filenameOverride ?? download.suggestedFilename();
  const dir = path.resolve(process.cwd(), opts.downloadsDir ?? 'downloads');
  fs.mkdirSync(dir, { recursive: true });
  const savedPath = path.join(dir, filename);
  await download.saveAs(savedPath);

  test.info().annotations.push({ type: 'downloadPath', description: savedPath });

  return { filename, path: savedPath, download };
}

// ─── previewGridAndCsvHeaders ──────────────────────────────────────────────

export interface PreviewHeadersOptions {
  /** Absolute path to the downloaded CSV file. */
  csvPath: string;
  /** CSS for header cells. Default: `'thead th'`. */
  headersSelector?: string;
}

export interface HeaderPreview {
  uiHeaders: string[];
  csvHeaders: string[];
  csvRowCount: number;
}

/**
 * Authoring aid: read the UI grid's column headers AND the CSV's headers (plus
 * row count), log them to the console, and return them. Call this once when
 * authoring a new CSV-vs-grid scenario to learn what column names exist on
 * each side, BEFORE building the `columnMap` / `ignoreUiColumns` /
 * `ignoreCsvColumns` config in test-data JSON.
 *
 * Headers are run through `buildStableHeaderKeys` so empty / duplicate names
 * surface with the same `_col_N` / `_2` / `_3` synthesis that the row
 * collectors apply — what you see here is what the helper will compare
 * against later.
 *
 * @example
 * ```typescript
 * // Run once during scenario authoring; remove the call once columnMap is right.
 * await previewGridAndCsvHeaders(page, { csvPath: downloadedFilePath });
 * ```
 */
export async function previewGridAndCsvHeaders(
  page: Page,
  opts: PreviewHeadersOptions,
): Promise<HeaderPreview> {
  if (!fs.existsSync(opts.csvPath)) {
    throw new Error(
      `[CSV-GRID:preview] CSV file not found at "${opts.csvPath}". Ensure download is saved before calling previewGridAndCsvHeaders.`,
    );
  }
  const uiHeaders = buildStableHeaderKeys(
    await page.locator(opts.headersSelector ?? 'thead th').allInnerTexts(),
  );
  const csvRows = parseCsv(fs.readFileSync(opts.csvPath, 'utf-8'));
  const csvHeaders = csvRows.length > 0 ? Object.keys(csvRows[0]) : [];

  // eslint-disable-next-line no-console
  console.log('[CSV-GRID:preview] UI HEADERS:', JSON.stringify(uiHeaders));
  // eslint-disable-next-line no-console
  console.log('[CSV-GRID:preview] CSV HEADERS:', JSON.stringify(csvHeaders));
  // eslint-disable-next-line no-console
  console.log(`[CSV-GRID:preview] CSV ROW COUNT: ${csvRows.length}`);

  return { uiHeaders, csvHeaders, csvRowCount: csvRows.length };
}
