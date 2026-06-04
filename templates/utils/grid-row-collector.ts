/**
 * grid-row-collector.ts — Strategies for extracting rows from a web datagrid,
 * including pagination handling.
 *
 * The companion pure-logic file `csv-grid-compare.ts` operates on already-collected
 * `Row[]`. This file is where Playwright touches the DOM: header extraction, cell
 * extraction, pagination walks.
 *
 * Pagination strategies provided (pick whichever matches the app's grid):
 *   - singlePageCollector   — no pagination; current view only
 *   - clickNextCollector    — walks pages via a "Next" button until disabled
 *   - pageSizeMaxCollector  — sets page-size dropdown to max, then collects
 *   - infiniteScrollCollector — scrolls until row count stabilizes
 *
 * All collectors return `{ headers, rows }`. Header keys are stable:
 *   - Empty header text → synthesized as `_col_{index}` (e.g. checkbox column)
 *   - Duplicate header text → second/third occurrence suffixed `_2`, `_3`, ...
 *
 * The team-owned page helper composes a collector with `verifyExportedCsvMatchesGrid`
 * — choose the right collector for the page's pagination idiom, then pass to the
 * verifier.
 *
 * Cell text is trimmed at extraction time (DOM whitespace is typically incidental
 * formatting). CSV cell whitespace is preserved by parseCsv; if your app produces
 * cells with meaningful whitespace, write a custom collector.
 */

import type { Page, Locator } from '@playwright/test';

// ─── Types ─────────────────────────────────────────────────────────────────

export type Row = Record<string, string>;

export interface CollectedGridData {
  headers: string[];
  rows: Row[];
}

/** A row collector reads UI rows from `page` and returns headers + rows. */
export type RowCollector = (page: Page) => Promise<CollectedGridData>;

// ─── Collector: singlePageCollector ────────────────────────────────────────

export interface SinglePageCollectorOpts {
  /** CSS for header cells, e.g. 'thead th'. */
  headersSelector: string;
  /** CSS for body rows, e.g. 'tbody tr'. */
  rowsSelector: string;
  /** CSS for cells WITHIN a row, e.g. 'td'. Default: 'td'. */
  cellSelector?: string;
}

/** Collect rows from the current view only — no pagination handling. */
export function singlePageCollector(opts: SinglePageCollectorOpts): RowCollector {
  return async (page) => extractCurrentView(page, opts);
}

// ─── Collector: clickNextCollector ─────────────────────────────────────────

export interface ClickNextCollectorOpts {
  headersSelector: string;
  rowsSelector: string;
  cellSelector?: string;
  /** CSS for the "Next" button (or its container). MUST resolve to exactly one element. */
  nextButtonSelector: string;
  /**
   * Custom predicate for "is the next button disabled?". Defaults to checking
   * common patterns: aria-disabled="true", disabled attr, `.disabled` class,
   * or HTMLButtonElement.disabled.
   */
  isNextDisabled?: (page: Page) => Promise<boolean>;
  /** Wait for `networkidle` after each Next click. Default: true (Atlas-friendly). */
  waitForNetworkIdle?: boolean;
  /** Additional wait after each click (after networkidle). Default: 0. */
  postClickWaitMs?: number;
  /** Timeout for the networkidle wait. Default: 30000. */
  networkIdleTimeoutMs?: number;
  /** Safety cap on pagination iterations. Default: 100. */
  maxPages?: number;
}

/**
 * Walk pages by clicking a "Next" button until it becomes disabled or
 * `maxPages` is hit. Headers are read once (from the first page) since they
 * don't change across pages.
 */
export function clickNextCollector(opts: ClickNextCollectorOpts): RowCollector {
  return async (page) => {
    const headers = await readHeaderKeys(page, opts.headersSelector);
    const allRows: Row[] = [];
    const max = opts.maxPages ?? 100;
    const cell = opts.cellSelector ?? 'td';

    for (let pageNum = 1; pageNum <= max; pageNum++) {
      const view = await extractRowsForHeaders(page, opts.rowsSelector, cell, headers);
      allRows.push(...view);

      const nextBtn = page.locator(opts.nextButtonSelector);
      const disabled = opts.isNextDisabled
        ? await opts.isNextDisabled(page)
        : await defaultNextDisabled(nextBtn);
      if (disabled) break;

      if (pageNum === max) {
        // Hit safety cap — fail loud rather than silently truncate.
        throw new Error(
          `clickNextCollector: hit maxPages=${max} but Next button is still enabled. ` +
            `Increase maxPages in collector options, or check that isNextDisabled correctly detects the disabled state.`,
        );
      }

      await nextBtn.click();
      if (opts.waitForNetworkIdle ?? true) {
        await page.waitForLoadState('networkidle', {
          timeout: opts.networkIdleTimeoutMs ?? 30000,
        });
      }
      if (opts.postClickWaitMs && opts.postClickWaitMs > 0) {
        await page.waitForTimeout(opts.postClickWaitMs);
      }
    }

    return { headers, rows: allRows };
  };
}

// ─── Collector: pageSizeMaxCollector ───────────────────────────────────────

export interface PageSizeMaxCollectorOpts {
  headersSelector: string;
  rowsSelector: string;
  cellSelector?: string;
  /** CSS for the page-size <select> dropdown. MUST resolve to exactly one element. */
  pageSizeDropdownSelector: string;
  /** 'max' = pick the numerically largest option; or pass an explicit size. */
  desiredSize: 'max' | number;
  /** Wait for `networkidle` after selecting the size. Default: true. */
  waitForNetworkIdle?: boolean;
  networkIdleTimeoutMs?: number;
  /**
   * If the dataset exceeds the max page size, chain this collector after the
   * size change. Typical use: `fallbackCollector: clickNextCollector({ ... })`
   * to walk remaining pages at the larger size.
   */
  fallbackCollector?: RowCollector;
}

/**
 * Set the page-size dropdown (e.g. 10/25/50/100) to its largest option (or a
 * specific size), then collect from the current view. If the dataset still
 * exceeds the max page size, pass `fallbackCollector` to continue.
 */
export function pageSizeMaxCollector(opts: PageSizeMaxCollectorOpts): RowCollector {
  return async (page) => {
    const dropdown = page.locator(opts.pageSizeDropdownSelector);

    let target: string;
    if (opts.desiredSize === 'max') {
      const values = await dropdown.evaluate((el) => {
        const select = el as HTMLSelectElement;
        return Array.from(select.options).map((o) => o.value);
      });
      const numeric = values
        .map((v) => ({ raw: v, num: parseFloat(v) }))
        .filter((x) => !Number.isNaN(x.num));
      if (numeric.length === 0) {
        throw new Error(
          `pageSizeMaxCollector: no numeric options found in dropdown "${opts.pageSizeDropdownSelector}".`,
        );
      }
      numeric.sort((a, b) => b.num - a.num);
      target = numeric[0].raw;
    } else {
      target = String(opts.desiredSize);
    }

    await dropdown.selectOption(target);

    if (opts.waitForNetworkIdle ?? true) {
      await page.waitForLoadState('networkidle', {
        timeout: opts.networkIdleTimeoutMs ?? 30000,
      });
    }

    if (opts.fallbackCollector) {
      return opts.fallbackCollector(page);
    }

    return extractCurrentView(page, opts);
  };
}

// ─── Collector: pageNumberCollector ────────────────────────────────────────

export interface PageNumberCollectorOpts {
  headersSelector: string;
  rowsSelector: string;
  cellSelector?: string;
  /**
   * CSS for the currently-active page indicator element (the element inside the
   * active page-item that carries the current page number).
   * Default: `.pagination .page-item.active [data-key]` — matches the
   * react-bootstrap-style `data-key` attribute convention. Apps that put the
   * number in text content should override with
   * `.pagination .page-item.active .page-link`.
   */
  activePageSelector?: string;
  /**
   * How to read the current page number from the activePageSelector element.
   *  - `'data-key'`: read the `data-key` attribute (react-bootstrap convention)
   *  - `'aria-label'`: read the `aria-label` attribute and parse the first integer
   *  - `'text'`: parse the element's text content as an integer
   *  - custom function for other patterns
   * Default: `'data-key'`.
   */
  pageNumberSource?: 'data-key' | 'aria-label' | 'text' | ((el: Locator) => Promise<number>);
  /**
   * Function that builds the CSS selector for clicking the link that advances
   * to the given page number. Default: `(n) => `.pagination [data-key="${n}"]`.
   * For vanilla Bootstrap (number is text content), override with something like
   * `(n) => `.pagination .page-link:text-is("${n}")``.
   */
  nextPageSelector?: (pageNumber: number) => string;
  /** Wait for `networkidle` after each click. Default: true. */
  waitForNetworkIdle?: boolean;
  networkIdleTimeoutMs?: number;
  /** Safety cap on number of pages walked. Default: 100. */
  maxPages?: number;
}

/**
 * Walk a numbered-page pagination control (Bootstrap-style: First / 1 / 2 / 3 / Last)
 * by clicking successive page-number links until no `currentPage + 1` link exists.
 *
 * **Built-in pacing — always on, no opt-out needed:** after each page-click the
 * collector waits for BOTH (a) the pagination control's active page indicator to
 * advance to the new page number AND (b) at least one row to be attached in
 * `tbody`. This is required because `waitForLoadState('networkidle')` ALONE is
 * insufficient on most React grids: the grid briefly clears the row container
 * during the transition and networkidle can resolve while it's still empty,
 * causing the next read to return 0 rows. Both waits + networkidle together
 * produce reliable page-by-page reads.
 *
 * Defaults target react-bootstrap-style pagination (page numbers in `data-key`
 * attribute). For vanilla Bootstrap or other libraries, override
 * `activePageSelector`, `nextPageSelector`, and `pageNumberSource`.
 */
export function pageNumberCollector(opts: PageNumberCollectorOpts): RowCollector {
  const activeSel = opts.activePageSelector ?? '.pagination .page-item.active [data-key]';
  const nextSelFn = opts.nextPageSelector ?? ((n: number) => `.pagination [data-key="${n}"]`);
  const source = opts.pageNumberSource ?? 'data-key';
  const maxPages = opts.maxPages ?? 100;
  const cell = opts.cellSelector ?? 'td';
  const waitNetIdle = opts.waitForNetworkIdle ?? true;
  const netTimeout = opts.networkIdleTimeoutMs ?? 30000;

  return async (page) => {
    const headers = buildStableHeaderKeys(await page.locator(opts.headersSelector).allInnerTexts());
    const allRows: Row[] = [];

    for (let i = 0; i < maxPages; i++) {
      // 1) Extract every visible row on the current page
      const pageRows = await extractRowsForHeaders(page, opts.rowsSelector, cell, headers);
      allRows.push(...pageRows);

      // 2) Determine current page number from the active indicator
      const activeEl = page.locator(activeSel).first();
      const activeCount = await activeEl.count();
      if (activeCount === 0) break; // no pagination present — single page
      const currentPage = await readPageNumber(activeEl, source);
      if (currentPage == null) break; // can't determine — stop safely

      // 3) Check whether a next-page link exists
      const newPage = currentPage + 1;
      const nextLink = page.locator(nextSelFn(newPage));
      if ((await nextLink.count()) === 0) break;

      if (i === maxPages - 1) {
        throw new Error(
          `pageNumberCollector: hit maxPages=${maxPages} but a next-page link is still present (next would be page ${newPage}). ` +
            `Increase maxPages, or verify that activePageSelector / pageNumberSource / nextPageSelector are correct for this app.`,
        );
      }

      // 4) Click and wait robustly for the transition to complete
      await nextLink.first().click();
      // 4a) Wait for the active page indicator to advance to the new number.
      //     This rules out the case where networkidle resolves before the React
      //     component re-renders the pagination control.
      await page.waitForFunction(
        ({ sel, src, np }: { sel: string; src: 'data-key' | 'aria-label' | 'text'; np: number }) => {
          const el = document.querySelector(sel);
          if (!el) return false;
          let n: number | null = null;
          if (src === 'data-key') {
            const v = el.getAttribute('data-key');
            n = v == null ? null : parseInt(v, 10);
          } else if (src === 'aria-label') {
            const v = el.getAttribute('aria-label');
            const m = v?.match(/\d+/);
            n = m ? parseInt(m[0], 10) : null;
          } else {
            const m = (el.textContent ?? '').match(/\d+/);
            n = m ? parseInt(m[0], 10) : null;
          }
          return n === np;
        },
        { sel: activeSel, src: (typeof source === 'string' ? source : 'data-key') as 'data-key' | 'aria-label' | 'text', np: newPage },
        { timeout: netTimeout },
      );
      // 4b) Wait for tbody (or the row container) to repopulate from the API response.
      await page.locator(opts.rowsSelector).first().waitFor({ state: 'attached', timeout: netTimeout });
      // 4c) networkidle as a final settle.
      if (waitNetIdle) {
        await page.waitForLoadState('networkidle', { timeout: netTimeout });
      }
    }

    return { headers, rows: allRows };
  };
}

async function readPageNumber(
  el: Locator,
  source: PageNumberCollectorOpts['pageNumberSource'],
): Promise<number | null> {
  if (typeof source === 'function') {
    return source(el);
  }
  if (source === 'aria-label') {
    const v = await el.getAttribute('aria-label');
    const m = v?.match(/\d+/);
    return m ? parseInt(m[0], 10) : null;
  }
  if (source === 'text') {
    const v = await el.textContent();
    const m = v?.match(/\d+/);
    return m ? parseInt(m[0], 10) : null;
  }
  // default 'data-key'
  const v = await el.getAttribute('data-key');
  return v == null ? null : parseInt(v, 10);
}

// ─── Collector: infiniteScrollCollector ────────────────────────────────────

export interface InfiniteScrollCollectorOpts {
  headersSelector: string;
  rowsSelector: string;
  cellSelector?: string;
  /**
   * CSS for the scrollable container. If omitted, scrolls the window.
   * Required for grids that scroll inside their own div rather than the page.
   */
  scrollContainerSelector?: string;
  /** Consecutive scrolls with no new rows before declaring "done". Default: 3. */
  stableChecks?: number;
  /** Pause after each scroll, to let new rows render. Default: 500ms. */
  scrollDelayMs?: number;
  /** Safety cap on scroll iterations. Default: 100. */
  maxScrolls?: number;
}

/**
 * Scroll down repeatedly until the row count stops growing for `stableChecks`
 * consecutive iterations, then extract all rows.
 */
export function infiniteScrollCollector(opts: InfiniteScrollCollectorOpts): RowCollector {
  return async (page) => {
    const headers = await readHeaderKeys(page, opts.headersSelector);
    const cell = opts.cellSelector ?? 'td';
    const stableNeeded = opts.stableChecks ?? 3;
    const delay = opts.scrollDelayMs ?? 500;
    const max = opts.maxScrolls ?? 100;

    let stableCount = 0;
    let lastCount = -1;

    for (let i = 0; i < max; i++) {
      if (opts.scrollContainerSelector) {
        await page.locator(opts.scrollContainerSelector).evaluate((el) => {
          el.scrollTop = el.scrollHeight;
        });
      } else {
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      }
      await page.waitForTimeout(delay);

      const count = await page.locator(opts.rowsSelector).count();
      if (count === lastCount) {
        stableCount++;
        if (stableCount >= stableNeeded) break;
      } else {
        stableCount = 0;
        lastCount = count;
      }
    }

    const rows = await extractRowsForHeaders(page, opts.rowsSelector, cell, headers);
    return { headers, rows };
  };
}

// ─── Internals ─────────────────────────────────────────────────────────────

async function extractCurrentView(
  page: Page,
  opts: { headersSelector: string; rowsSelector: string; cellSelector?: string },
): Promise<CollectedGridData> {
  const headers = await readHeaderKeys(page, opts.headersSelector);
  const rows = await extractRowsForHeaders(
    page,
    opts.rowsSelector,
    opts.cellSelector ?? 'td',
    headers,
  );
  return { headers, rows };
}

async function readHeaderKeys(page: Page, selector: string): Promise<string[]> {
  const raw = await page.locator(selector).allInnerTexts();
  return buildStableHeaderKeys(raw);
}

/**
 * Make header keys stable + collision-free:
 *   - Empty → `_col_{index}` (typical for checkbox / row-number columns)
 *   - Duplicates → first stays as-is, subsequent get `_2`, `_3`, etc.
 *
 * Exported for unit testing.
 */
export function buildStableHeaderKeys(rawHeaders: string[]): string[] {
  const seen = new Map<string, number>();
  return rawHeaders.map((h, idx) => {
    const trimmed = (h ?? '').replace(/\s+/g, ' ').trim();
    if (!trimmed) return `_col_${idx}`;
    const count = seen.get(trimmed) ?? 0;
    seen.set(trimmed, count + 1);
    return count === 0 ? trimmed : `${trimmed}_${count + 1}`;
  });
}

async function extractRowsForHeaders(
  page: Page,
  rowsSelector: string,
  cellSelector: string,
  headers: string[],
): Promise<Row[]> {
  const rowLocs = await page.locator(rowsSelector).all();
  const rows: Row[] = [];
  for (const rl of rowLocs) {
    const cellTexts = await rl.locator(cellSelector).allInnerTexts();
    const row: Row = {};
    headers.forEach((h, i) => {
      // Trim DOM cell text — incidental whitespace is the norm in rendered HTML.
      // Normalizers in csv-grid-compare handle further canonicalization.
      row[h] = (cellTexts[i] ?? '').replace(/\s+/g, ' ').trim();
    });
    rows.push(row);
  }
  return rows;
}

async function defaultNextDisabled(loc: Locator): Promise<boolean> {
  // Try several common patterns. If none match, treat as enabled (caller can
  // pass isNextDisabled for app-specific logic).
  const ariaDisabled = await loc.getAttribute('aria-disabled').catch(() => null);
  if (ariaDisabled === 'true') return true;
  return loc
    .evaluate((el) => {
      const elem = el as HTMLElement;
      if (elem.hasAttribute('disabled')) return true;
      if (elem.classList.contains('disabled')) return true;
      if ((elem as HTMLButtonElement).disabled === true) return true;
      // Bootstrap / many React libraries wrap the disabled <li> around an <a>
      const parent = elem.parentElement;
      if (parent && parent.classList.contains('disabled')) return true;
      return false;
    })
    .catch(() => false);
}
