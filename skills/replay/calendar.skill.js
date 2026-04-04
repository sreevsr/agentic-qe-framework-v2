/**
 * calendar.skill.js — Replay engine skill for Telerik RadCalendar interactions.
 *
 * Handles all calendar date selection scenarios for Telerik RadCalendar components.
 * Each exported function is an action invokable via the SKILL step type.
 *
 * Actions:
 *   click-weekdays-ahead  — Pick a date N weekdays (Mon-Fri) ahead of today
 *   click-date            — Pick a specific date (month/day/year)
 *   click-next-available  — Find and click the next available (non-disabled) date
 *   read-selected         — Read the currently selected date without changing it
 *   list-available        — Return all available dates in the current month view
 *
 * Usage in plan:
 *   { "skill": "calendar/click-date", "params": { "month": "April", "day": 15, "year": 2026 } }
 *   { "skill": "calendar/click-weekdays-ahead", "params": { "offsetDays": 3 } }
 *   { "skill": "calendar/click-next-available", "params": { "startFrom": "today" } }
 *   { "skill": "calendar/read-selected", "params": {} }
 *   { "skill": "calendar/list-available", "params": {} }
 *
 * Telerik RadCalendar DOM structure:
 *   Root: div.RadCalendar (calendarSelector, e.g., #ScheduleDateCalendar)
 *   Title: .rcTitle (e.g., "April 2026")
 *   Table: table.rcMainTable
 *   Cells: td.availableDate (clickable), td.rcWeekend (Sat/Sun), td.rcOtherMonth
 *   Selected: td.rcSelected
 *   Disabled: td without .availableDate class
 *   Navigation: .rcNext a (forward), .rcPrev a (backward)
 *   Each clickable cell contains: <a href="#">{day number}</a>
 *
 * Discovered: 2026-04-03 (CallWizard Scheduling Calendar)
 */

const DAY_NAMES   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const MONTH_NAMES = ['January','February','March','April','May','June',
                     'July','August','September','October','November','December'];

// ============================================================
// Shared helpers
// ============================================================

function formatDate(date) {
  return `${DAY_NAMES[date.getDay()]}, ${MONTH_NAMES[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

function parseMonthName(name) {
  const idx = MONTH_NAMES.findIndex(m => m.toLowerCase() === name.toLowerCase());
  if (idx === -1) throw new Error(`Unknown month name: "${name}"`);
  return idx;
}

/**
 * Navigate the calendar to show a specific month/year.
 * Clicks forward or backward arrows as needed (max 24 iterations).
 */
async function navigateToMonth(page, calSel, targetMonth, targetYear) {
  for (let i = 0; i < 24; i++) {
    const titleText = await page.evaluate((sel) => {
      const title = document.querySelector(`${sel} .rcTitle`);
      return title ? title.textContent.trim() : '';
    }, calSel);

    const parts = titleText.split(' ');
    if (parts.length < 2) break;

    const dispMonth = MONTH_NAMES.indexOf(parts[0]);
    const dispYear  = parseInt(parts[1], 10);

    if (dispYear === targetYear && dispMonth === targetMonth) {
      return; // correct month displayed
    }

    const dispDate = new Date(dispYear, dispMonth, 1);
    const tgtDate  = new Date(targetYear, targetMonth, 1);

    if (tgtDate > dispDate) {
      const nextBtn = await page.$(`${calSel} .rcNext a, ${calSel} th.rcNext a`);
      if (!nextBtn) throw new Error(`Calendar: cannot navigate forward — no .rcNext button found`);
      await nextBtn.click();
      await page.waitForTimeout(400);
    } else {
      const prevBtn = await page.$(`${calSel} .rcPrev a, ${calSel} th.rcPrev a`);
      if (!prevBtn) throw new Error(`Calendar: cannot navigate backward — no .rcPrev button found`);
      await prevBtn.click();
      await page.waitForTimeout(400);
    }
  }
}

/**
 * Click a specific day cell in the currently displayed month.
 * @param {object} options
 * @param {boolean} options.weekdaysOnly - If true, skip weekend cells
 * @param {boolean} options.availableOnly - If true, only click cells with .availableDate class
 */
async function clickDayCell(page, calSel, day, options = {}) {
  const { weekdaysOnly = false, availableOnly = true } = options;

  const clicked = await page.evaluate(
    ({ sel, day, weekdaysOnly, availableOnly }) => {
      const cal = document.querySelector(sel);
      if (!cal) return { ok: false, reason: 'calendar not found' };

      const tds = Array.from(cal.querySelectorAll('table.rcMainTable td'));
      const cell = tds.find((td) => {
        const txt = td.textContent.trim();
        if (txt !== String(day)) return false;
        // Skip other-month cells (days from prev/next month shown greyed out)
        if (td.className.includes('rcOtherMonth')) return false;
        if (availableOnly && !td.className.includes('availableDate')) return false;
        if (weekdaysOnly && td.className.includes('rcWeekend')) return false;
        return true;
      });

      if (!cell) {
        // Collect info for error message
        const availableDays = tds
          .filter(td => td.className.includes('availableDate') && !td.className.includes('rcOtherMonth'))
          .map(td => td.textContent.trim());
        return {
          ok: false,
          reason: `Day ${day} not clickable (available days: ${availableDays.join(', ')})`,
          isDisabled: tds.some(td => td.textContent.trim() === String(day) && !td.className.includes('availableDate'))
        };
      }

      const link = cell.querySelector('a');
      if (!link) return { ok: false, reason: `Day ${day} cell has no <a> link` };

      link.click();
      return { ok: true, cellClass: cell.className };
    },
    { sel: calSel, day, weekdaysOnly, availableOnly }
  );

  return clicked;
}

/**
 * Confirm the selected day matches expected.
 */
async function confirmSelection(page, calSel, expectedDay) {
  await page.waitForTimeout(600);
  const selectedDay = await page.evaluate((sel) => {
    const selected = document.querySelector(`${sel} td.rcSelected`);
    return selected ? selected.textContent.trim() : null;
  }, calSel);

  if (String(selectedDay) !== String(expectedDay)) {
    throw new Error(`Calendar: selection not confirmed. Expected day ${expectedDay}, got: ${selectedDay}`);
  }
}

// ============================================================
// Action: click-weekdays-ahead
// ============================================================

/**
 * Compute the date N weekdays ahead of today, click that cell.
 *
 * @param {import('playwright').Page} page
 * @param {object} params
 * @param {number|string} params.offsetDays - Number of weekdays to skip forward
 * @param {string} [params.calendarSelector] - CSS selector for RadCalendar root
 * @returns {string} Formatted date, e.g., "Wednesday, April 8, 2026"
 */
async function clickWeekdaysAhead(page, params) {
  const offset = parseInt(String(params.offsetDays), 10);
  const calSel = params.calendarSelector || '#ScheduleDateCalendar';

  if (isNaN(offset) || offset < 1) {
    throw new Error(`calendar/click-weekdays-ahead: offsetDays must be a positive integer, got: ${params.offsetDays}`);
  }

  // Compute target date
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let count = 0;
  const target = new Date(today);
  while (count < offset) {
    target.setDate(target.getDate() + 1);
    if (target.getDay() !== 0 && target.getDay() !== 6) count++;
  }

  await page.waitForSelector(calSel, { state: 'visible', timeout: 10000 });
  await navigateToMonth(page, calSel, target.getMonth(), target.getFullYear());

  const clicked = await clickDayCell(page, calSel, target.getDate(), { weekdaysOnly: true });
  if (!clicked.ok) {
    throw new Error(`calendar/click-weekdays-ahead: ${clicked.reason} (target: ${formatDate(target)})`);
  }

  await confirmSelection(page, calSel, target.getDate());
  return formatDate(target);
}

// ============================================================
// Action: click-date
// ============================================================

/**
 * Pick a specific date by month, day, year.
 *
 * @param {import('playwright').Page} page
 * @param {object} params
 * @param {string|number} params.month - Month name ("April") or number (4, 1-based)
 * @param {number} params.day - Day of month (1-31)
 * @param {number} params.year - Full year (e.g., 2026)
 * @param {string} [params.calendarSelector]
 * @param {boolean} [params.allowWeekend=true] - Whether to allow clicking weekend dates
 * @returns {string} Formatted date
 */
async function clickDate(page, params) {
  const calSel = params.calendarSelector || '#ScheduleDateCalendar';
  const day = parseInt(String(params.day), 10);
  const year = parseInt(String(params.year), 10);
  const month = typeof params.month === 'string' ? parseMonthName(params.month) : parseInt(String(params.month), 10) - 1;
  const allowWeekend = params.allowWeekend !== false;

  if (isNaN(day) || isNaN(year) || isNaN(month)) {
    throw new Error(`calendar/click-date: invalid date params — month: ${params.month}, day: ${params.day}, year: ${params.year}`);
  }

  const target = new Date(year, month, day);
  target.setHours(0, 0, 0, 0);

  await page.waitForSelector(calSel, { state: 'visible', timeout: 10000 });
  await navigateToMonth(page, calSel, month, year);

  const clicked = await clickDayCell(page, calSel, day, { weekdaysOnly: !allowWeekend });
  if (!clicked.ok) {
    if (clicked.isDisabled) {
      throw new Error(`calendar/click-date: ${formatDate(target)} is disabled in the calendar. ${clicked.reason}`);
    }
    throw new Error(`calendar/click-date: ${clicked.reason} (target: ${formatDate(target)})`);
  }

  await confirmSelection(page, calSel, day);
  return formatDate(target);
}

// ============================================================
// Action: click-next-available
// ============================================================

/**
 * Find and click the next available (non-disabled) date starting from a given date.
 * Useful when a specific date might be disabled (holiday, fully booked, etc.).
 *
 * @param {import('playwright').Page} page
 * @param {object} params
 * @param {string} [params.startFrom="today"] - "today" or ISO date string "2026-04-15"
 * @param {boolean} [params.weekdaysOnly=true] - Skip weekends
 * @param {string} [params.calendarSelector]
 * @param {number} [params.maxLookahead=30] - Max days to search forward
 * @returns {string} Formatted date of the date that was clicked
 */
async function clickNextAvailable(page, params) {
  const calSel = params.calendarSelector || '#ScheduleDateCalendar';
  const weekdaysOnly = params.weekdaysOnly !== false;
  const maxLookahead = parseInt(String(params.maxLookahead || 30), 10);

  let start;
  if (!params.startFrom || params.startFrom === 'today') {
    start = new Date();
  } else {
    start = new Date(params.startFrom);
  }
  start.setHours(0, 0, 0, 0);

  await page.waitForSelector(calSel, { state: 'visible', timeout: 10000 });

  // Try each day starting from start, up to maxLookahead
  const candidate = new Date(start);
  for (let i = 0; i < maxLookahead; i++) {
    candidate.setDate(candidate.getDate() + (i === 0 ? 0 : 1));

    // Skip weekends if weekdaysOnly
    if (weekdaysOnly && (candidate.getDay() === 0 || candidate.getDay() === 6)) continue;

    // Navigate to correct month
    await navigateToMonth(page, calSel, candidate.getMonth(), candidate.getFullYear());

    // Try clicking this day
    const clicked = await clickDayCell(page, calSel, candidate.getDate(), { weekdaysOnly, availableOnly: true });
    if (clicked.ok) {
      await confirmSelection(page, calSel, candidate.getDate());
      return formatDate(candidate);
    }
    // Day was disabled — try next
  }

  throw new Error(`calendar/click-next-available: no available date found within ${maxLookahead} days from ${formatDate(start)}`);
}

// ============================================================
// Action: read-selected
// ============================================================

/**
 * Read the currently selected date from the calendar without clicking anything.
 *
 * @param {import('playwright').Page} page
 * @param {object} params
 * @param {string} [params.calendarSelector]
 * @returns {string} Formatted date, or null if nothing is selected
 */
async function readSelected(page, params) {
  const calSel = params.calendarSelector || '#ScheduleDateCalendar';

  await page.waitForSelector(calSel, { state: 'visible', timeout: 10000 });

  const result = await page.evaluate((sel) => {
    const cal = document.querySelector(sel);
    if (!cal) return null;

    const selected = cal.querySelector('td.rcSelected');
    if (!selected) return null;

    const day = selected.textContent.trim();
    const title = cal.querySelector('.rcTitle');
    const titleText = title ? title.textContent.trim() : '';

    return { day, titleText };
  }, calSel);

  if (!result) return null;

  // Parse "April 2026" from title
  const parts = result.titleText.split(' ');
  if (parts.length < 2) return result.day;

  const month = parseMonthName(parts[0]);
  const year = parseInt(parts[1], 10);
  const date = new Date(year, month, parseInt(result.day, 10));

  return formatDate(date);
}

// ============================================================
// Action: list-available
// ============================================================

/**
 * Return all available (clickable) dates in the currently displayed month.
 *
 * @param {import('playwright').Page} page
 * @param {object} params
 * @param {string} [params.calendarSelector]
 * @param {boolean} [params.weekdaysOnly=false] - If true, exclude weekend dates
 * @returns {string[]} Array of formatted dates
 */
async function listAvailable(page, params) {
  const calSel = params.calendarSelector || '#ScheduleDateCalendar';
  const weekdaysOnly = params.weekdaysOnly === true;

  await page.waitForSelector(calSel, { state: 'visible', timeout: 10000 });

  const result = await page.evaluate(
    ({ sel, weekdaysOnly }) => {
      const cal = document.querySelector(sel);
      if (!cal) return { days: [], titleText: '' };

      const title = cal.querySelector('.rcTitle');
      const titleText = title ? title.textContent.trim() : '';

      const tds = Array.from(cal.querySelectorAll('table.rcMainTable td'));
      const days = tds
        .filter(td => {
          if (!td.className.includes('availableDate')) return false;
          if (td.className.includes('rcOtherMonth')) return false;
          if (weekdaysOnly && td.className.includes('rcWeekend')) return false;
          return true;
        })
        .map(td => td.textContent.trim());

      return { days, titleText };
    },
    { sel: calSel, weekdaysOnly }
  );

  // Parse month/year from title and format each date
  const parts = result.titleText.split(' ');
  if (parts.length < 2) return result.days;

  const month = parseMonthName(parts[0]);
  const year = parseInt(parts[1], 10);

  return result.days.map(dayStr => {
    const date = new Date(year, month, parseInt(dayStr, 10));
    return formatDate(date);
  });
}

// ============================================================
// Exports
// ============================================================

module.exports = {
  clickWeekdaysAhead,
  clickDate,
  clickNextAvailable,
  readSelected,
  listAvailable,
};
