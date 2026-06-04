/**
 * DataGridColumnHelpers.helpers.ts — Three team-owned helpers for common
 * column-oriented verifications on paginated datagrids.
 *
 *   1. verifyColumnDatesInRange   — "every row's date in column X is within [from, to]"
 *   2. sumColumnAcrossPages       — "what's the sum of column X across all pages?"
 *   3. captureFirstRowMatching    — "find the first row where column X satisfies P,
 *                                    capture values from columns A, B, C"
 *
 * All three use a `RowCollector` (e.g., pageNumberCollector, singlePageCollector)
 * to read rows — pagination is handled by the collector, not by these helpers,
 * exactly like verifyExportedCsvMatchesGrid does.
 *
 * Each helper:
 *   - Returns a structured report the scenario can assert on.
 *   - Attaches the report (JSON) to the Playwright test report for debugging.
 *   - Logs a console summary that's visible in CI logs.
 *   - Carries an @steps JSDoc block so the Explorer can walk it for state advancement.
 *
 * ## Picking the right helper
 *
 * | Need | Use |
 * |---|---|
 * | "Every cell in column X is a date within range [from, to]" | verifyColumnDatesInRange |
 * | "Sum the values in column X across all pages" | sumColumnAcrossPages |
 * | "Find the first row matching predicate P, capture values from it" | captureFirstRowMatching |
 * | "Exported CSV matches the displayed grid row-by-row, column-by-column" | verifyExportedCsvMatchesGrid (in DataGridCsvVerifier.helpers.ts) |
 *
 * ## Scenario usage (natural language → spec mapping)
 *
 * ```markdown
 * USE_HELPER: DataGridColumnHelpers.verifyColumnDatesInRange -> {{startDateResult}}
 * VERIFY: {{startDateResult.ok}} is true
 * REPORT: Compared {{startDateResult.rowsCompared}} rows; {{startDateResult.mismatches.length}} mismatches
 *
 * USE_HELPER: DataGridColumnHelpers.sumColumnAcrossPages -> {{summedUpDollarValue}}
 * VERIFY_SOFT: {{summedUpDollarValue.sum}} equals {{totalDollarValue}}
 *
 * USE_HELPER: DataGridColumnHelpers.captureFirstRowMatching -> {{firstMatch}}
 * CAPTURE: {{firstMatch.cells['Invoice No']}} as {{selectedInvoiceNumber}}
 * CAPTURE: {{firstMatch.cells['Total($)']}} as {{totalDollarValue}}
 * ```
 *
 * ## Spec usage (TypeScript call site)
 *
 * ```typescript
 * import {
 *   verifyColumnDatesInRange,
 *   sumColumnAcrossPages,
 *   captureFirstRowMatching,
 * } from '../../pages/DataGridColumnHelpers.helpers';
 * import { pageNumberCollector } from '../../utils/grid-row-collector';
 *
 * const startDateResult = await verifyColumnDatesInRange(page, {
 *   columnName: 'Start Date',
 *   keyColumnName: 'Invoice No',
 *   fromDate: fromDate,
 *   toDate: toDate,
 *   rowCollector: pageNumberCollector({ headersSelector: 'thead th', rowsSelector: 'tbody tr' }),
 * });
 * expect(startDateResult.ok).toBe(true);
 * ```
 */

import { type Page, test } from '@playwright/test';
import { type RowCollector } from '../utils/grid-row-collector';

// ─── Helper 1: verifyColumnDatesInRange ────────────────────────────────────

export interface VerifyColumnDatesInRangeOptions {
  /** UI column name whose dates will be verified (e.g., 'Start Date'). */
  columnName: string;
  /** UI column name used to identify each row in failure reports (e.g., 'Invoice No'). */
  keyColumnName: string;
  /** Inclusive lower bound of the date range. Time-of-day is ignored — comparison is by calendar day. */
  fromDate: Date;
  /** Inclusive upper bound of the date range. Time-of-day is ignored — comparison is by calendar day. */
  toDate: Date;
  /** Row collection strategy. Use pageNumberCollector for paginated grids. */
  rowCollector: RowCollector;
  /**
   * Parse a column cell's raw string into a Date. Default extracts the first
   * MM/DD/YYYY (or M/D/YY) pattern anywhere in the string and returns UTC
   * midnight of that date. If your column shows times you want to honor, or
   * uses a different date format, supply your own parser.
   *
   * Return null to signal "unparseable" — these rows are reported as mismatches
   * with reason: 'unparseable'.
   */
  parseDate?: (raw: string) => Date | null;
  /** Base name for attached JSON report (default: 'column-date-range-diff'). */
  attachmentBaseName?: string;
}

export interface DateRangeMismatch {
  /** Value of keyColumnName for the offending row. */
  rowKey: string;
  /** Raw cell text from the columnName column. */
  raw: string;
  /** Parsed Date, or null if parsing failed. */
  parsed: Date | null;
  /** Why this row counted as a mismatch. */
  reason: 'before-range' | 'after-range' | 'unparseable';
}

export interface DateRangeReport {
  columnName: string;
  /** Number of rows the collector returned (i.e., total rows examined). */
  rowsCompared: number;
  /** Rows whose date was outside the range or unparseable. */
  mismatches: DateRangeMismatch[];
  /** True iff every row's date parsed successfully and fell within [fromDate, toDate]. */
  ok: boolean;
}

/**
 * Verify that every data row's date in the named column falls within an inclusive range.
 *
 * @steps
 * 1. Read column headers and every data row from the datagrid using {{rowCollector}} (walks pagination if configured)
 * 2. For each row, parse the value in {{columnName}} as a date via {{parseDate}} (default: extract MM/DD/YYYY pattern)
 * 3. VERIFY: every parsed date falls within [{{fromDate}}, {{toDate}}] (inclusive, calendar-day comparison — time-of-day ignored)
 * 4. CAPTURE: a list of mismatched rows with their {{keyColumnName}} value, the raw column text, and the failure reason
 * 5. REPORT: rowsCompared and mismatches.length (with the first 5 mismatch details to console)
 * 6. ATTACH: a structured JSON report of every mismatch to the Playwright test report
 */
export async function verifyColumnDatesInRange(
  page: Page,
  opts: VerifyColumnDatesInRangeOptions,
): Promise<DateRangeReport> {
  const parseDate = opts.parseDate ?? defaultParseMdyDate;
  const fromMs = toUtcMidnight(opts.fromDate).getTime();
  const toMs = toUtcMidnight(opts.toDate).getTime();

  const { headers, rows } = await opts.rowCollector(page);

  if (!headers.includes(opts.columnName)) {
    throw new Error(
      `[COLUMN-DATE-RANGE] Column "${opts.columnName}" not found in grid headers: [${headers.join(', ')}]. ` +
        `Check the columnName option (it must match the UI header text exactly, including punctuation and case) ` +
        `or verify the rowCollector's headersSelector points at the right header row.`,
    );
  }
  if (!headers.includes(opts.keyColumnName)) {
    throw new Error(
      `[COLUMN-DATE-RANGE] Key column "${opts.keyColumnName}" not found in grid headers: [${headers.join(', ')}].`,
    );
  }

  const mismatches: DateRangeMismatch[] = [];
  for (const row of rows) {
    const raw = row[opts.columnName] ?? '';
    const parsed = parseDate(raw);
    const rowKey = row[opts.keyColumnName] ?? '<unknown>';

    if (parsed == null) {
      mismatches.push({ rowKey, raw, parsed: null, reason: 'unparseable' });
      continue;
    }
    const parsedDay = toUtcMidnight(parsed).getTime();
    if (parsedDay < fromMs) {
      mismatches.push({ rowKey, raw, parsed, reason: 'before-range' });
    } else if (parsedDay > toMs) {
      mismatches.push({ rowKey, raw, parsed, reason: 'after-range' });
    }
  }

  const report: DateRangeReport = {
    columnName: opts.columnName,
    rowsCompared: rows.length,
    mismatches,
    ok: mismatches.length === 0,
  };

  const baseName = opts.attachmentBaseName ?? 'column-date-range-diff';
  await test.info().attach(`${baseName}.json`, {
    body: JSON.stringify(
      { ...report, fromDate: opts.fromDate.toISOString(), toDate: opts.toDate.toISOString() },
      null,
      2,
    ),
    contentType: 'application/json',
  });

  // eslint-disable-next-line no-console
  console.log(
    `[COLUMN-DATE-RANGE] Column "${opts.columnName}" — compared ${report.rowsCompared} row(s) ` +
      `against [${isoDateOnly(opts.fromDate)}, ${isoDateOnly(opts.toDate)}]`,
  );
  // eslint-disable-next-line no-console
  console.log(
    `[COLUMN-DATE-RANGE] ${report.ok ? 'OK' : 'FAIL'}: ${report.mismatches.length} mismatch(es)`,
  );
  for (const m of report.mismatches.slice(0, 5)) {
    // eslint-disable-next-line no-console
    console.log(
      `[COLUMN-DATE-RANGE]   ${opts.keyColumnName}=${m.rowKey}: "${m.raw}" → ${m.reason}`,
    );
  }
  if (report.mismatches.length > 5) {
    // eslint-disable-next-line no-console
    console.log(
      `[COLUMN-DATE-RANGE]   ... and ${report.mismatches.length - 5} more mismatch(es) (see attached JSON)`,
    );
  }

  return report;
}

// ─── Helper 2: sumColumnAcrossPages ────────────────────────────────────────

export interface SumColumnAcrossPagesOptions {
  /** UI column name whose values will be summed (e.g., 'Total($)'). */
  columnName: string;
  /** Row collection strategy. Use pageNumberCollector for paginated grids. */
  rowCollector: RowCollector;
  /**
   * Parse a column cell's raw string into a number. Default strips currency
   * symbols ($ £ € ¥ ₹), thousands commas, percent signs, and surrounding
   * parens (which are treated as accounting negatives — "(123.45)" → -123.45).
   * Empty strings and "--" are treated as 0. Unparseable values produce NaN
   * and are counted in `unparseableCount` (treated as 0 in the running sum).
   */
  parseNumber?: (raw: string) => number;
  /** Decimal places to round the final sum to (default 2, suitable for currency). */
  precision?: number;
  /** Base name for attached JSON report (default: 'column-sum-report'). */
  attachmentBaseName?: string;
}

export interface ColumnSumReport {
  columnName: string;
  /** Total rows the collector returned. */
  rowsCompared: number;
  /** Sum of parsed values, rounded to `precision` decimal places. */
  sum: number;
  /** Count of rows whose values failed to parse (treated as 0 in the sum). */
  unparseableCount: number;
  /** Per-row values for debugging (first 100 only, to keep attachments small). */
  perRow: Array<{ raw: string; parsed: number }>;
}

/**
 * Sum a numeric/currency column across every data row in a paginated datagrid.
 *
 * @steps
 * 1. Read every data row from the datagrid using {{rowCollector}} (walks pagination if configured)
 * 2. For each row, parse the value in {{columnName}} as a number via {{parseNumber}} (default: currency-aware)
 * 3. CAPTURE: the sum of all parsed values, rounded to {{precision}} decimal places
 * 4. REPORT: rowsCompared, the final sum, and unparseableCount (rows with non-numeric values)
 * 5. ATTACH: per-row raw/parsed breakdown for debugging
 */
export async function sumColumnAcrossPages(
  page: Page,
  opts: SumColumnAcrossPagesOptions,
): Promise<ColumnSumReport> {
  const parseNumber = opts.parseNumber ?? defaultParseCurrency;
  const precision = opts.precision ?? 2;

  const { headers, rows } = await opts.rowCollector(page);

  if (!headers.includes(opts.columnName)) {
    throw new Error(
      `[COLUMN-SUM] Column "${opts.columnName}" not found in grid headers: [${headers.join(', ')}].`,
    );
  }

  let sum = 0;
  let unparseableCount = 0;
  const perRow: Array<{ raw: string; parsed: number }> = [];

  for (const row of rows) {
    const raw = row[opts.columnName] ?? '';
    const parsed = parseNumber(raw);
    if (Number.isNaN(parsed)) {
      unparseableCount++;
      if (perRow.length < 100) perRow.push({ raw, parsed: NaN });
      continue;
    }
    sum += parsed;
    if (perRow.length < 100) perRow.push({ raw, parsed });
  }

  // Round once at the end to avoid accumulating floating-point error per row.
  const roundedSum = parseFloat(sum.toFixed(precision));

  const report: ColumnSumReport = {
    columnName: opts.columnName,
    rowsCompared: rows.length,
    sum: roundedSum,
    unparseableCount,
    perRow,
  };

  const baseName = opts.attachmentBaseName ?? 'column-sum-report';
  await test.info().attach(`${baseName}.json`, {
    body: JSON.stringify(report, null, 2),
    contentType: 'application/json',
  });

  // eslint-disable-next-line no-console
  console.log(`[COLUMN-SUM] Column "${opts.columnName}" — summed ${report.rowsCompared} row(s)`);
  // eslint-disable-next-line no-console
  console.log(
    `[COLUMN-SUM] Total: ${report.sum}` +
      (unparseableCount > 0 ? ` (${unparseableCount} unparseable row(s) treated as 0)` : ''),
  );

  return report;
}

// ─── Helper 3: captureFirstRowMatching ─────────────────────────────────────

export interface CaptureFirstRowMatchingOptions {
  /** Column whose values the matcher will inspect (e.g., 'Total($)'). */
  predicateColumn: string;
  /**
   * Function returning true for matching rows. Receives the raw cell value
   * (string) from `predicateColumn`. Use parseFloat / regex / trim as needed.
   *
   * Common patterns:
   *   - Non-zero numeric: `(v) => parseFloat(v.replace(/[$,]/g, '')) > 0`
   *   - Non-empty text:   `(v) => v.trim() !== '' && v !== '--'`
   *   - Specific value:   `(v) => v.trim() === 'Pending'`
   *   - Matches regex:    `(v) => /BOL_\d+/.test(v)`
   */
  matcher: (rawValue: string) => boolean;
  /** Column names to capture from the matched row (e.g., ['Invoice No', 'Total($)']). */
  captureColumns: string[];
  /** Row collection strategy. */
  rowCollector: RowCollector;
  /** Base name for attached JSON report (default: 'captured-row'). */
  attachmentBaseName?: string;
}

export interface CapturedRow {
  /** Zero-based index of the matched row in the collected sequence. */
  rowIndex: number;
  /** Captured cell values keyed by column name (only columns listed in captureColumns). */
  cells: Record<string, string>;
}

/**
 * Find the FIRST row whose `predicateColumn` value satisfies `matcher`, then
 * capture the values of `captureColumns` from that row. Throws if no row
 * matches — the caller's intent is "find one; absence is a real failure."
 *
 * @steps
 * 1. Read every data row from the datagrid using {{rowCollector}} (walks pagination if configured)
 * 2. For each row in order, evaluate {{matcher}} against the value in {{predicateColumn}}
 * 3. Find the FIRST row whose matcher returns true
 * 4. CAPTURE: the values of {{captureColumns}} from that row
 * 5. ATTACH: the captured cells to the test report
 * 6. THROW if no row matches (caller intent is "find one"; absence is failure)
 */
export async function captureFirstRowMatching(
  page: Page,
  opts: CaptureFirstRowMatchingOptions,
): Promise<CapturedRow> {
  const { headers, rows } = await opts.rowCollector(page);

  if (!headers.includes(opts.predicateColumn)) {
    throw new Error(
      `[CAPTURE-ROW] Predicate column "${opts.predicateColumn}" not found in grid headers: [${headers.join(', ')}].`,
    );
  }
  for (const col of opts.captureColumns) {
    if (!headers.includes(col)) {
      throw new Error(
        `[CAPTURE-ROW] Capture column "${col}" not found in grid headers: [${headers.join(', ')}].`,
      );
    }
  }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const predicateValue = row[opts.predicateColumn] ?? '';
    if (opts.matcher(predicateValue)) {
      const cells: Record<string, string> = {};
      for (const col of opts.captureColumns) {
        cells[col] = row[col] ?? '';
      }
      const captured: CapturedRow = { rowIndex: i, cells };

      const baseName = opts.attachmentBaseName ?? 'captured-row';
      await test.info().attach(`${baseName}.json`, {
        body: JSON.stringify(
          { ...captured, predicateColumn: opts.predicateColumn, totalRowsScanned: rows.length },
          null,
          2,
        ),
        contentType: 'application/json',
      });

      // eslint-disable-next-line no-console
      console.log(
        `[CAPTURE-ROW] Matched row index ${i} on column "${opts.predicateColumn}" ` +
          `(value: "${predicateValue}"). Captured: ${JSON.stringify(cells)}`,
      );

      return captured;
    }
  }

  throw new Error(
    `[CAPTURE-ROW] No row matched the predicate on column "${opts.predicateColumn}" across ${rows.length} row(s). ` +
      `Either the data lacks a matching row (a real failure to surface) or the matcher function is too strict.`,
  );
}

// ─── Internal helpers (not exported) ───────────────────────────────────────

/**
 * Default date parser: extracts the FIRST MM/DD/YYYY (or M/D/YY etc.) pattern
 * found anywhere in the string and returns UTC midnight of that date. Lenient
 * counterpart to the framework's built-in `asDateMDY` normalizer, but returns
 * a Date object instead of an ISO string.
 *
 * Examples:
 *   "05/22/2026"               → 2026-05-22T00:00:00Z
 *   "12:45 PM 05/22/2026"      → 2026-05-22T00:00:00Z
 *   "Created on 5/22/26 by X"  → 2026-05-22T00:00:00Z
 *   "2026-05-22"               → null  (no MDY pattern — use a custom parser for ISO inputs)
 *   ""                         → null
 */
function defaultParseMdyDate(raw: string): Date | null {
  const v = (raw ?? '').trim();
  if (!v) return null;
  const m = v.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (!m) return null;
  const [, mm, dd, yy] = m;
  const year = yy.length === 2 ? parseInt(`20${yy}`, 10) : parseInt(yy, 10);
  const month = parseInt(mm, 10) - 1;
  const day = parseInt(dd, 10);
  if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day)) return null;
  return new Date(Date.UTC(year, month, day));
}

/**
 * Default currency/number parser. Strips currency symbols, thousands commas,
 * percent signs, and surrounding parens (treated as accounting negative).
 * Empty/dash/N/A → 0. Unparseable → NaN.
 *
 * Examples:
 *   "$1,234.50"   → 1234.5
 *   "(1,234.50)"  → -1234.5
 *   "12.5%"       → 12.5
 *   "--"          → 0
 *   ""            → 0
 *   "N/A"         → 0
 *   "abc"         → NaN
 */
function defaultParseCurrency(raw: string): number {
  const v = (raw ?? '').trim();
  if (!v || v === '--' || v === '—' || v.toUpperCase() === 'N/A') return 0;
  const negative = /^\(.*\)$/.test(v);
  const stripped = v.replace(/[$£€¥₹,%()]/g, '').trim();
  if (!stripped) return 0;
  const n = parseFloat(stripped);
  if (Number.isNaN(n)) return NaN;
  return negative ? -n : n;
}

/** Truncate a Date to UTC midnight of its calendar day. */
function toUtcMidnight(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** Format a Date as "YYYY-MM-DD" using its UTC fields. */
function isoDateOnly(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}
