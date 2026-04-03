/**
 * calendar-weekday.skill.js — Replay engine skill for Telerik RadCalendar weekday date selection.
 *
 * Computes a date N weekdays (Mon–Fri) ahead of today, clicks the matching
 * calendar date cell, optionally navigates to the next month if needed, and
 * returns the formatted date string for capture.
 *
 * Discovered: 2026-04-03 (QE Plan Generator v3) — CallWizard Scheduling Calendar
 * Calendar: Telerik RadCalendar (class: RadCalendar RadCalendar_calendlyish)
 * Calendar ID: #ScheduleDateCalendar  |  Table ID: #ScheduleDateCalendar_Top
 *
 * Usage in plan:
 *   {
 *     "type": "SKILL",
 *     "action": {
 *       "skill": "calendar-weekday/click-weekdays-ahead",
 *       "params": { "offsetDays": 3, "calendarSelector": "#ScheduleDateCalendar" },
 *       "captureAs": "appointmentDate"
 *     }
 *   }
 */

/**
 * Compute the date N weekdays ahead of today, click that cell in the Telerik RadCalendar,
 * wait for the selection to register, and return a formatted date string.
 *
 * @param {import('playwright').Page} page
 * @param {object} params
 * @param {number|string} params.offsetDays  - Number of weekdays to skip forward (e.g. 3)
 * @param {string} [params.calendarSelector] - CSS selector for the RadCalendar root (default: '#ScheduleDateCalendar')
 * @returns {string}  Formatted date string, e.g. "Wednesday, April 8, 2026"
 */
async function clickWeekdaysAhead(page, params) {
  const offset = parseInt(String(params.offsetDays), 10);
  const calSel = params.calendarSelector || '#ScheduleDateCalendar';

  if (isNaN(offset) || offset < 1) {
    throw new Error(`calendar-weekday/click-weekdays-ahead: offsetDays must be a positive integer, got: ${params.offsetDays}`);
  }

  // — Step 1: Compute the target date ——————————————————————————
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let count = 0;
  const target = new Date(today);
  while (count < offset) {
    target.setDate(target.getDate() + 1);
    const dow = target.getDay();
    if (dow !== 0 && dow !== 6) {
      count++;
    }
  }

  const targetDay   = target.getDate();
  const targetMonth = target.getMonth();
  const targetYear  = target.getFullYear();

  const DAY_NAMES   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const MONTH_NAMES = ['January','February','March','April','May','June',
                       'July','August','September','October','November','December'];

  const formattedDate = `${DAY_NAMES[target.getDay()]}, ${MONTH_NAMES[targetMonth]} ${targetDay}, ${targetYear}`;

  // — Step 2: Ensure the calendar is showing the correct month ———————
  await page.waitForSelector(calSel, { state: 'visible', timeout: 10000 });

  for (let i = 0; i < 12; i++) {
    const titleText = await page.evaluate((sel) => {
      const title = document.querySelector(`${sel} .rcTitle`);
      return title ? title.textContent.trim() : '';
    }, calSel);

    const parts = titleText.split(' ');
    if (parts.length >= 2) {
      const dispMonth = MONTH_NAMES.indexOf(parts[0]);
      const dispYear  = parseInt(parts[1], 10);

      if (dispYear === targetYear && dispMonth === targetMonth) {
        break;
      }

      const dispDate = new Date(dispYear, dispMonth, 1);
      const tgtDate  = new Date(targetYear, targetMonth, 1);

      if (tgtDate > dispDate) {
        const nextBtn = await page.$(`${calSel} .rcNext a, ${calSel} th.rcNext a`);
        if (nextBtn) {
          await nextBtn.click();
          await page.waitForTimeout(400);
        } else {
          break;
        }
      } else {
        const prevBtn = await page.$(`${calSel} .rcPrev a, ${calSel} th.rcPrev a`);
        if (prevBtn) {
          await prevBtn.click();
          await page.waitForTimeout(400);
        } else {
          break;
        }
      }
    } else {
      break;
    }
  }

  // — Step 3: Click the target date cell ————————————————————————
  const clicked = await page.evaluate(
    ({ sel, day }) => {
      const cal = document.querySelector(sel);
      if (!cal) return { ok: false, reason: 'calendar not found' };

      const tds = Array.from(cal.querySelectorAll('table.rcMainTable td'));
      const cell = tds.find((td) => {
        const txt = td.textContent.trim();
        return (
          txt === String(day) &&
          td.className.includes('availableDate') &&
          !td.className.includes('rcWeekend')
        );
      });

      if (!cell) return { ok: false, reason: `No available weekday cell found for day ${day}` };

      const link = cell.querySelector('a');
      if (!link) return { ok: false, reason: 'No <a> link inside cell' };

      link.click();
      return { ok: true, cellClass: cell.className };
    },
    { sel: calSel, day: targetDay }
  );

  if (!clicked.ok) {
    throw new Error(`calendar-weekday/click-weekdays-ahead: ${clicked.reason} (target: ${formattedDate})`);
  }

  // — Step 4: Wait for calendar to reflect the selection ——————————————
  await page.waitForTimeout(600);

  const selectedDay = await page.evaluate((sel) => {
    const selected = document.querySelector(`${sel} td.rcSelected`);
    return selected ? selected.textContent.trim() : null;
  }, calSel);

  if (String(selectedDay) !== String(targetDay)) {
    throw new Error(
      `calendar-weekday/click-weekdays-ahead: Selection not confirmed. Expected day ${targetDay}, got: ${selectedDay}`
    );
  }

  return formattedDate;
}

module.exports = { clickWeekdaysAhead };
