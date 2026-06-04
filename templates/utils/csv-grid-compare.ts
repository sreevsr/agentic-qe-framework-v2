/**
 * csv-grid-compare.ts — Framework-level utility for comparing exported CSV files
 * against the data displayed in a web datagrid.
 *
 * PURE LOGIC ONLY — no Playwright, no fs, no DOM. Operates on already-collected
 * `Row[]` arrays. The companion `grid-row-collector.ts` handles UI extraction
 * (including pagination); team-owned page helpers
 * (`output/pages/{app}/*.helpers.ts`) wire the two together and attach reports
 * to the Playwright test.
 *
 * Design contract (locked in design review):
 *   - Unmapped UI or CSV columns are a HARD FAIL (throws UnmappedColumnError).
 *     Forces explicit decision per column; prevents silent drift when the app
 *     or API adds a new column.
 *   - Row count / set mismatch is NOT a hard fail — the helper continues with
 *     the intersection (matched by keyColumn) and reports keys present on
 *     only one side in `rowsInUiNotInCsv` / `rowsInCsvNotInUi`. `ok` is false.
 *
 * @see output/utils/grid-row-collector.ts — pagination-aware row collection
 * @see output/pages/atlas/DataGridCsvVerifier.helpers.ts — Atlas entry point
 */

import { parse as parseCsvSync } from 'csv-parse/sync';

// ─── Built-in normalizers ──────────────────────────────────────────────────

/**
 * Names of built-in value normalizers. Used in `ColumnMapEntry.normalizer` to
 * align UI text formatting with CSV text formatting before equality comparison.
 *
 * Each normalizer is applied to BOTH the UI value and the CSV value before
 * comparison. A normalizer returning the same canonical string for two
 * differently-formatted inputs makes them match.
 */
export type NormalizerName =
  | 'asTrimmed'           // collapse internal whitespace runs to single space, trim
  | 'asCaseInsensitive'   // asTrimmed then toLowerCase
  | 'asCompactLower'      // strip commas + whitespace, lowercase — reconciles list-style fields where UI and CSV use different separators
  | 'asNumber'            // strip $ , %; treat (n) as -n; parseFloat → string
  | 'asInteger'           // asNumber then Math.trunc → string
  | 'asCurrency'          // asNumber then toFixed(2)
  | 'asDate'              // parse strict (date pattern at start) to ISO YYYY-MM-DD
  | 'asDateMDY'           // extract first MM/DD/YYYY pattern from anywhere in the string, return ISO YYYY-MM-DD
  | 'asDateTime'          // parse to ISO 8601 UTC
  | 'asBoolean';          // Yes/No/Y/N/True/False/1/0 → 'true' | 'false'

const BUILT_IN_NORMALIZERS: Record<NormalizerName, (v: string) => string> = {
  asTrimmed,
  asCaseInsensitive,
  asCompactLower,
  asNumber,
  asInteger,
  asCurrency,
  asDate,
  asDateMDY,
  asDateTime,
  asBoolean,
};

function asTrimmed(raw: string): string {
  return (raw ?? '').replace(/\s+/g, ' ').trim();
}

function asCaseInsensitive(raw: string): string {
  return asTrimmed(raw).toLowerCase();
}

/**
 * Strip commas and whitespace, then lowercase. Used to reconcile list-style
 * fields where UI and CSV use different separators (e.g. UI joins items with
 * single spaces, CSV joins them with commas; or one side has whitespace
 * between badge elements that the other side doesn't render).
 *
 * Examples:
 *   "Data Issue Net Weight Conflict"          → "dataissuenetweightconflict"
 *   "Data Issue, Net Weight Conflict"          → "dataissuenetweightconflict"
 *   "data issue,net weight conflict"           → "dataissuenetweightconflict"
 */
function asCompactLower(raw: string): string {
  return (raw ?? '').toLowerCase().replace(/[,\s]+/g, '');
}

function asNumber(raw: string): string {
  const v = asTrimmed(raw);
  if (!v || v === '-' || v === '—' || v.toUpperCase() === 'N/A') return '';
  // Detect accounting-negative: (123.45) → -123.45
  const negative = /^\(.*\)$/.test(v);
  // Strip currency symbols, thousands commas, percent sign, surrounding parens
  const stripped = v.replace(/[$£€¥₹,%()]/g, '').trim();
  if (!stripped) return '';
  const n = parseFloat(stripped);
  if (Number.isNaN(n)) return v; // unparseable — preserve so mismatch surfaces
  return String(negative ? -n : n);
}

function asInteger(raw: string): string {
  const n = asNumber(raw);
  if (!n) return n;
  const parsed = parseFloat(n);
  if (Number.isNaN(parsed)) return n;
  return String(Math.trunc(parsed));
}

function asCurrency(raw: string): string {
  const n = asNumber(raw);
  if (!n) return n;
  const parsed = parseFloat(n);
  if (Number.isNaN(parsed)) return n;
  return parsed.toFixed(2);
}

function asDate(raw: string): string {
  const v = asTrimmed(raw);
  if (!v) return '';

  // ISO 8601 (date or datetime) — extract date portion
  let m = v.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ].*)?$/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;

  // MM/DD/YYYY or M/D/YYYY or MM/DD/YY (US slash-separated format)
  m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (m) {
    const [, mm, dd, yy] = m;
    const year = yy.length === 2 ? `20${yy}` : yy;
    return `${year}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
  }

  // MM-DD-YYYY / MM-DD-YY (US dash-separated format, common in filenames)
  m = v.match(/^(\d{1,2})-(\d{1,2})-(\d{2}|\d{4})$/);
  if (m) {
    const [, mm, dd, yy] = m;
    const year = yy.length === 2 ? `20${yy}` : yy;
    return `${year}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
  }

  // Last resort — let JS parse it
  const parsed = Date.parse(v);
  if (!Number.isNaN(parsed)) {
    const d = new Date(parsed);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
  }

  // Unparseable — return original (will mismatch, which is the right signal)
  return v;
}

/**
 * Extract the FIRST `MM/DD/YYYY` (or `M/D/YY`, etc.) pattern found ANYWHERE in
 * the string and return ISO `YYYY-MM-DD`. Unlike `asDate` (which requires the
 * date to be the dominant token at the start), this is lenient: useful when UI
 * cells mix date with time/label/etc. in varying orders, and you want
 * **date-only comparison** (deliberately ignoring time-of-day differences).
 *
 * Examples:
 *   "05/22/2026"               → "2026-05-22"
 *   "12:45 PM 05/22/2026"      → "2026-05-22"
 *   "Created on 5/22/26 by X"  → "2026-05-22"
 *   "2026-05-22"               → returns the input unchanged (no MDY pattern) —
 *                                use `asDate` for ISO inputs.
 *   ""                         → ""
 *
 * If no MDY pattern is found, returns the trimmed/collapsed input — which will
 * cause a mismatch downstream (the right signal).
 *
 * **When to upgrade to time-sensitive comparison:** If a column needs both date
 * AND time to match (not just date), switch the column's normalizer to
 * `asDateTime` (if both sides are Date.parse-compatible) or define a custom
 * normalizer for app-specific datetime formats.
 */
function asDateMDY(raw: string): string {
  const v = asTrimmed(raw);
  if (!v) return '';
  const m = v.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (!m) return v;
  const [, mm, dd, yy] = m;
  const year = yy.length === 2 ? `20${yy}` : yy;
  return `${year}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
}

function asDateTime(raw: string): string {
  const v = asTrimmed(raw);
  if (!v) return '';
  const parsed = Date.parse(v);
  if (Number.isNaN(parsed)) return v;
  return new Date(parsed).toISOString();
}

function asBoolean(raw: string): string {
  const v = asCaseInsensitive(raw);
  if (!v) return '';
  if (['true', 'yes', 'y', '1', 't'].includes(v)) return 'true';
  if (['false', 'no', 'n', '0', 'f'].includes(v)) return 'false';
  return v;
}

// ─── Config types ──────────────────────────────────────────────────────────

/**
 * Defines how a single UI column maps to one or more CSV columns, with an
 * optional normalizer applied to both sides before equality comparison.
 *
 * - `csvColumn` — simple rename ("Load ID" UI → "load_id" CSV)
 * - `csvColumns` + `join` — split-merge ("Driver Name" UI ← "first_name" + "last_name" CSV joined by " ")
 * - `normalizer` — name of a built-in (NormalizerName) or a key into
 *    `customNormalizers`. Applied to both UI and CSV values.
 */
export interface ColumnMapEntry {
  csvColumn?: string;
  csvColumns?: string[];
  join?: string; // default ' '
  normalizer?: NormalizerName | string;
}

export interface CsvCompareConfig {
  /** UI column name whose value uniquely identifies each row. Used to align UI rows to CSV rows. */
  keyColumn: string;
  /** UI header → CSV mapping. The keyColumn MUST appear in this map. */
  columnMap: Record<string, ColumnMapEntry>;
  /** UI columns to skip entirely (e.g. checkbox column, row-number column). */
  ignoreUiColumns?: string[];
  /** CSV columns to skip entirely (e.g. audit fields). */
  ignoreCsvColumns?: string[];
  /** App-specific normalizers, referenced by name from ColumnMapEntry.normalizer. */
  customNormalizers?: Record<string, (v: string) => string>;
  /**
   * Minimum number of rows that MUST appear on BOTH sides (i.e. `rowsCompared`)
   * for the comparison to be considered meaningful. Throws InsufficientRowsError
   * if the actual intersection count is below this. Defends against silent-pass
   * conditions: empty grid + empty CSV → `ok: true` looks valid but verifies
   * nothing. Also catches misconfigured rowCollector / wrong csvPath / forgotten
   * filter step. If omitted (default), no minimum is enforced — supports
   * scenarios that legitimately expect "both empty".
   */
  minRowsCompared?: number;
}

// ─── Result types ──────────────────────────────────────────────────────────

export type Row = Record<string, string>;

export interface CellMismatch {
  rowKey: string;
  uiColumn: string;
  csvColumn: string;       // actual CSV header(s) — joined display for split-merge
  uiRaw: string;
  csvRaw: string;
  uiNormalized: string;
  csvNormalized: string;
  normalizerUsed?: string;
}

export interface DiffReport {
  /** Rows that appeared on BOTH sides (matched by keyColumn). */
  rowsCompared: number;
  /** UI columns compared per row (excludes ignored columns). */
  columnsCompared: number;
  /** Cells whose normalized values disagree. */
  mismatches: CellMismatch[];
  /** keyColumn values present in UI but missing from CSV. */
  rowsInUiNotInCsv: string[];
  /** keyColumn values present in CSV but missing from UI. */
  rowsInCsvNotInUi: string[];
  /** True iff: zero mismatches AND no rows missing on either side. */
  ok: boolean;
}

// ─── Errors ────────────────────────────────────────────────────────────────

export class UnmappedColumnError extends Error {
  constructor(
    public readonly side: 'ui' | 'csv',
    public readonly unmapped: string[],
  ) {
    const sideUpper = side.toUpperCase();
    const ignoreKey = side === 'ui' ? 'ignoreUiColumns' : 'ignoreCsvColumns';
    super(
      `Unmapped ${sideUpper} column(s): [${unmapped.join(', ')}]. ` +
        `Add each to columnMap (as ${side === 'ui' ? 'a UI key' : 'a csvColumn/csvColumns value'}) ` +
        `or to ${ignoreKey} in CsvCompareConfig.`,
    );
    this.name = 'UnmappedColumnError';
  }
}

export class DuplicateRowKeyError extends Error {
  constructor(
    public readonly side: 'ui' | 'csv',
    public readonly duplicateKey: string,
  ) {
    super(
      `Duplicate row key "${duplicateKey}" found in ${side.toUpperCase()} rows. ` +
        `Row alignment requires unique values in keyColumn. Pick a different keyColumn or de-duplicate the data.`,
    );
    this.name = 'DuplicateRowKeyError';
  }
}

export class MissingKeyColumnError extends Error {
  constructor(keyColumn: string) {
    super(
      `keyColumn "${keyColumn}" is not present in CsvCompareConfig.columnMap. ` +
        `The keyColumn MUST appear in columnMap so the helper knows how to read its value from the CSV.`,
    );
    this.name = 'MissingKeyColumnError';
  }
}

export class InsufficientRowsError extends Error {
  constructor(
    public readonly rowsCompared: number,
    public readonly minRowsCompared: number,
    public readonly uiRowsTotal: number,
    public readonly csvRowsTotal: number,
  ) {
    super(
      `[CSV-GRID] rowsCompared=${rowsCompared} is below minRowsCompared=${minRowsCompared}. ` +
        `UI rows collected: ${uiRowsTotal}. CSV rows parsed: ${csvRowsTotal}. ` +
        `Possible causes: (1) filter returned no/few matching rows, (2) rowCollector ` +
        `misconfigured (wrong selectors → 0 UI rows), (3) wrong csvPath or empty CSV file, ` +
        `(4) scenario authoring mistake (forgot a filter or step). If "both empty" is the ` +
        `intended state, omit minRowsCompared or set it to 0.`,
    );
    this.name = 'InsufficientRowsError';
  }
}

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Parse a CSV string into an array of objects (header row → keys).
 * BOM-tolerant, handles RFC 4180 edge cases (quoted commas, quoted newlines,
 * escaped quotes, CRLF/LF line endings).
 *
 * Cell whitespace is preserved as-is — normalizers handle trimming/case.
 */
export function parseCsv(raw: string): Row[] {
  // csv-parse handles BOM via `bom: true`; columns: true → header row becomes keys.
  // trim: false → preserve cell whitespace; normalizers decide what to do with it.
  const records = parseCsvSync(raw, {
    columns: true,
    skip_empty_lines: true,
    bom: true,
    trim: false,
    relax_column_count: false,
  }) as Row[];
  // csv-parse returns values as strings already; coerce any non-string defensively.
  return records.map((rec) => {
    const out: Row = {};
    for (const [k, v] of Object.entries(rec)) {
      out[k] = v == null ? '' : String(v);
    }
    return out;
  });
}

/**
 * Compare UI grid rows against CSV rows per the configured column mapping.
 *
 * @throws {UnmappedColumnError}    if a UI or CSV column is neither in columnMap nor in the ignore list
 * @throws {MissingKeyColumnError}  if the keyColumn is not in columnMap
 * @throws {DuplicateRowKeyError}   if the keyColumn has duplicate values on either side
 */
export function diffGridVsCsv(
  uiRows: Row[],
  csvRows: Row[],
  cfg: CsvCompareConfig,
): DiffReport {
  // ── 1. Sanity-check the config ────────────────────────────────────────
  if (!cfg.columnMap[cfg.keyColumn]) {
    throw new MissingKeyColumnError(cfg.keyColumn);
  }

  // ── 2. Validate UI columns against the map + ignore list ─────────────
  const uiHeaders = uiRows.length > 0 ? Object.keys(uiRows[0]) : [];
  const mappedUiHeaders = new Set(Object.keys(cfg.columnMap));
  const ignoredUi = new Set(cfg.ignoreUiColumns ?? []);
  const unmappedUi = uiHeaders.filter((h) => !mappedUiHeaders.has(h) && !ignoredUi.has(h));
  if (unmappedUi.length > 0) {
    throw new UnmappedColumnError('ui', unmappedUi);
  }

  // ── 3. Validate CSV columns against the map + ignore list ────────────
  const csvHeaders = csvRows.length > 0 ? Object.keys(csvRows[0]) : [];
  const mappedCsvHeaders = new Set<string>();
  for (const entry of Object.values(cfg.columnMap)) {
    if (entry.csvColumn) mappedCsvHeaders.add(entry.csvColumn);
    if (entry.csvColumns) entry.csvColumns.forEach((c) => mappedCsvHeaders.add(c));
  }
  const ignoredCsv = new Set(cfg.ignoreCsvColumns ?? []);
  const unmappedCsv = csvHeaders.filter((h) => !mappedCsvHeaders.has(h) && !ignoredCsv.has(h));
  if (unmappedCsv.length > 0) {
    throw new UnmappedColumnError('csv', unmappedCsv);
  }

  // ── 4. Resolve the normalizer registry (built-in + custom) ───────────
  const normalizers: Record<string, (v: string) => string> = {
    ...BUILT_IN_NORMALIZERS,
    ...(cfg.customNormalizers ?? {}),
  };

  // ── 5. Index rows by keyColumn for O(1) alignment ────────────────────
  const keyEntry = cfg.columnMap[cfg.keyColumn];
  const readCsvKey = (csvRow: Row): string => readCsvValue(csvRow, keyEntry);

  const uiIndex = indexByKey(uiRows, (r) => r[cfg.keyColumn] ?? '', 'ui');
  const csvIndex = indexByKey(csvRows, readCsvKey, 'csv');

  // ── 6. Compute set diffs ──────────────────────────────────────────────
  const uiKeys = new Set(uiIndex.keys());
  const csvKeys = new Set(csvIndex.keys());
  const rowsInUiNotInCsv = [...uiKeys].filter((k) => !csvKeys.has(k)).sort();
  const rowsInCsvNotInUi = [...csvKeys].filter((k) => !uiKeys.has(k)).sort();
  const commonKeys = [...uiKeys].filter((k) => csvKeys.has(k)).sort();

  // ── 6b. Insufficient-rows guard ──────────────────────────────────────
  // Fail loud BEFORE running the cell-by-cell comparison if the intersection
  // is below the configured floor. Catches silent-pass scenarios (both sides
  // empty), misconfigured rowCollector, wrong csvPath, missing filter step,
  // etc. Skipped if cfg.minRowsCompared is null/undefined.
  if (cfg.minRowsCompared != null && commonKeys.length < cfg.minRowsCompared) {
    throw new InsufficientRowsError(
      commonKeys.length,
      cfg.minRowsCompared,
      uiRows.length,
      csvRows.length,
    );
  }

  // ── 7. Compare each common row, cell by cell ─────────────────────────
  const mismatches: CellMismatch[] = [];
  const comparedUiColumns = Object.keys(cfg.columnMap); // includes keyColumn
  for (const key of commonKeys) {
    const ui = uiIndex.get(key)!;
    const csv = csvIndex.get(key)!;
    for (const uiCol of comparedUiColumns) {
      const entry = cfg.columnMap[uiCol];
      const uiRaw = ui[uiCol] ?? '';
      const csvRaw = readCsvValue(csv, entry);
      const csvColDisplay = entry.csvColumns
        ? entry.csvColumns.join(` ${entry.join ?? ' '} `)
        : entry.csvColumn ?? '<unmapped>';

      const normalizer = entry.normalizer ? normalizers[entry.normalizer] : undefined;
      if (entry.normalizer && !normalizer) {
        // Unknown normalizer name — fail loud (vs. silent identity normalization)
        throw new Error(
          `Unknown normalizer "${entry.normalizer}" for column "${uiCol}". ` +
            `Use a built-in (${(Object.keys(BUILT_IN_NORMALIZERS) as string[]).join(', ')}) or ` +
            `pass a custom one via customNormalizers.`,
        );
      }

      const uiNorm = normalizer ? normalizer(uiRaw) : uiRaw;
      const csvNorm = normalizer ? normalizer(csvRaw) : csvRaw;

      if (uiNorm !== csvNorm) {
        mismatches.push({
          rowKey: key,
          uiColumn: uiCol,
          csvColumn: csvColDisplay,
          uiRaw,
          csvRaw,
          uiNormalized: uiNorm,
          csvNormalized: csvNorm,
          normalizerUsed: entry.normalizer,
        });
      }
    }
  }

  return {
    rowsCompared: commonKeys.length,
    columnsCompared: comparedUiColumns.length,
    mismatches,
    rowsInUiNotInCsv,
    rowsInCsvNotInUi,
    ok:
      mismatches.length === 0 &&
      rowsInUiNotInCsv.length === 0 &&
      rowsInCsvNotInUi.length === 0,
  };
}

/** JSON pretty-print of the DiffReport — suitable for `test.info().attach()`. */
export function renderDiffJson(report: DiffReport): string {
  return JSON.stringify(report, null, 2);
}

/** Multi-line human-readable summary — suitable for `console.log` or CI logs. */
export function renderDiffSummary(report: DiffReport): string {
  const lines: string[] = [];
  lines.push(`[CSV-GRID] Compared ${report.rowsCompared} row(s) across ${report.columnsCompared} column(s)`);
  lines.push(
    `[CSV-GRID] ${report.ok ? 'OK' : 'FAIL'}: ` +
      `${report.mismatches.length} mismatch(es), ` +
      `${report.rowsInUiNotInCsv.length} row(s) in UI not in CSV, ` +
      `${report.rowsInCsvNotInUi.length} row(s) in CSV not in UI`,
  );
  if (report.rowsInUiNotInCsv.length > 0) {
    lines.push(`[CSV-GRID] Rows in UI not in CSV: ${report.rowsInUiNotInCsv.slice(0, 5).join(', ')}${report.rowsInUiNotInCsv.length > 5 ? ` (+${report.rowsInUiNotInCsv.length - 5} more)` : ''}`);
  }
  if (report.rowsInCsvNotInUi.length > 0) {
    lines.push(`[CSV-GRID] Rows in CSV not in UI: ${report.rowsInCsvNotInUi.slice(0, 5).join(', ')}${report.rowsInCsvNotInUi.length > 5 ? ` (+${report.rowsInCsvNotInUi.length - 5} more)` : ''}`);
  }
  const sample = report.mismatches.slice(0, 5);
  for (const m of sample) {
    lines.push(
      `[CSV-GRID]   row ${m.rowKey}, col "${m.uiColumn}" (csv: ${m.csvColumn}): ui="${m.uiRaw}" csv="${m.csvRaw}"` +
        (m.normalizerUsed ? ` [via ${m.normalizerUsed}]` : ''),
    );
  }
  if (report.mismatches.length > sample.length) {
    lines.push(`[CSV-GRID]   ... and ${report.mismatches.length - sample.length} more mismatch(es) (see attached JSON/HTML)`);
  }
  return lines.join('\n');
}

/**
 * Self-contained HTML report listing all mismatches in a table.
 * All cell values are HTML-escaped — safe to attach to the Playwright report.
 */
export function renderDiffHtml(report: DiffReport): string {
  const status = report.ok ? 'PASS' : 'FAIL';
  const color = report.ok ? '#0a7f2e' : '#b71c1c';
  const head = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>CSV ⇄ Grid Diff</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 1.5rem; color: #1a1a1a; }
  h1 { color: ${color}; margin: 0 0 .25rem; }
  .meta { color: #555; font-size: 0.9rem; margin-bottom: 1.5rem; }
  table { border-collapse: collapse; width: 100%; font-size: 0.9rem; }
  th, td { text-align: left; padding: 0.5rem 0.75rem; border-bottom: 1px solid #e0e0e0; vertical-align: top; }
  th { background: #f5f5f5; font-weight: 600; }
  tr:hover { background: #fafafa; }
  .ui { background: #fee; }
  .csv { background: #efe; }
  .raw { color: #777; font-size: 0.8rem; font-family: ui-monospace, "SF Mono", Menlo, monospace; }
  .norm { font-family: ui-monospace, "SF Mono", Menlo, monospace; }
  .missing-rows { background: #fff8e1; padding: 0.75rem 1rem; border-left: 4px solid #f9a825; margin: 0.5rem 0; }
</style>
</head>
<body>
<h1>${status}: CSV ⇄ Grid Comparison</h1>
<div class="meta">
  ${report.rowsCompared} row(s) compared &middot;
  ${report.columnsCompared} column(s) per row &middot;
  <strong>${report.mismatches.length}</strong> mismatch(es)
</div>`;

  let missing = '';
  if (report.rowsInUiNotInCsv.length > 0) {
    missing += `<div class="missing-rows"><strong>Rows in UI not in CSV (${report.rowsInUiNotInCsv.length}):</strong> ${escapeHtml(report.rowsInUiNotInCsv.join(', '))}</div>`;
  }
  if (report.rowsInCsvNotInUi.length > 0) {
    missing += `<div class="missing-rows"><strong>Rows in CSV not in UI (${report.rowsInCsvNotInUi.length}):</strong> ${escapeHtml(report.rowsInCsvNotInUi.join(', '))}</div>`;
  }

  let body = '';
  if (report.mismatches.length === 0) {
    body = '<p><em>No cell-level mismatches.</em></p>';
  } else {
    body =
      `<table>
<thead><tr>
  <th>Row key</th>
  <th>Column (UI → CSV)</th>
  <th>Normalizer</th>
  <th class="ui">UI value</th>
  <th class="csv">CSV value</th>
</tr></thead>
<tbody>` +
      report.mismatches
        .map(
          (m) => `
<tr>
  <td><strong>${escapeHtml(m.rowKey)}</strong></td>
  <td>${escapeHtml(m.uiColumn)} <span class="raw">→ ${escapeHtml(m.csvColumn)}</span></td>
  <td>${m.normalizerUsed ? escapeHtml(m.normalizerUsed) : '<em>none</em>'}</td>
  <td class="ui"><div class="norm">${escapeHtml(m.uiNormalized)}</div><div class="raw">raw: ${escapeHtml(m.uiRaw)}</div></td>
  <td class="csv"><div class="norm">${escapeHtml(m.csvNormalized)}</div><div class="raw">raw: ${escapeHtml(m.csvRaw)}</div></td>
</tr>`,
        )
        .join('') +
      `</tbody></table>`;
  }

  return head + missing + body + '\n</body></html>\n';
}

// ─── Internals ─────────────────────────────────────────────────────────────

function readCsvValue(csvRow: Row, entry: ColumnMapEntry): string {
  if (entry.csvColumns && entry.csvColumns.length > 0) {
    const joiner = entry.join ?? ' ';
    return entry.csvColumns.map((c) => csvRow[c] ?? '').join(joiner);
  }
  if (entry.csvColumn) {
    return csvRow[entry.csvColumn] ?? '';
  }
  return '';
}

function indexByKey(rows: Row[], keyFn: (r: Row) => string, side: 'ui' | 'csv'): Map<string, Row> {
  const map = new Map<string, Row>();
  for (const row of rows) {
    const key = keyFn(row);
    if (map.has(key)) {
      throw new DuplicateRowKeyError(side, key);
    }
    map.set(key, row);
  }
  return map;
}

function escapeHtml(s: string): string {
  return (s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
