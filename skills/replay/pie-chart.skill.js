/**
 * pie-chart.skill.js — Replay engine skill for scanning canvas-based pie charts.
 *
 * Hovers over pie chart segments at multiple angles and radii to capture
 * tooltip text for each segment. Works with Chart.js and similar libraries
 * that render tooltips as DOM elements on hover.
 *
 * Usage in plan:
 *   { "type": "SKILL", "action": { "skill": "pie-chart/scan", "params": { ... } } }
 */

/**
 * Scan a pie chart by hovering over segments and collecting tooltip data.
 *
 * @param {import('playwright').Page} page
 * @param {object} params
 * @param {string} params.chartTitle - Text near the chart to identify it (e.g., "Employee Distribution by Sub Unit")
 * @param {string} [params.canvasSelector] - CSS selector for the canvas (alternative to chartTitle)
 * @param {number} [params.angleStep=5] - Degrees between hover points (smaller = more thorough, slower)
 * @param {number[]} [params.radii=[0.4, 0.55, 0.7]] - Radius factors to scan at (0-1, relative to chart size)
 * @param {number} [params.hoverDelay=80] - Milliseconds to wait at each point for tooltip
 * @param {string} [params.tooltipSelector] - CSS selector for tooltip elements
 * @returns {object} { legends: string[], tooltips: { label, value, percentage }[], raw: string[] }
 */
async function scan(page, params) {
  const {
    chartTitle,
    canvasSelector,
    angleStep = 5,
    radii = [0.4, 0.55, 0.7],
    hoverDelay = 80,
    tooltipSelector = '[class*="tooltip"], [class*="Tooltip"], [role="tooltip"]',
  } = params;

  // Find the canvas
  let canvas;
  if (canvasSelector) {
    canvas = page.locator(canvasSelector).first();
  } else if (chartTitle) {
    // Find the chart container by title text, then find the canvas within it
    const container = page.locator(`div:has(> div:has-text("${chartTitle}")):has(canvas)`).first();
    canvas = container.locator('canvas').first();
  } else {
    throw new Error('pie-chart/scan requires either chartTitle or canvasSelector');
  }

  // Scroll into view
  await canvas.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);

  const box = await canvas.boundingBox();
  if (!box) throw new Error('Canvas not visible or not found');

  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;

  // Collect legend labels from DOM (if available)
  let legends = [];
  if (chartTitle) {
    const container = page.locator(`div:has(> div:has-text("${chartTitle}"))`).first();
    const legendItems = container.locator('li, [class*="legend-item"]');
    const count = await legendItems.count();
    for (let i = 0; i < count; i++) {
      const text = await legendItems.nth(i).textContent();
      if (text && text.trim()) legends.push(text.trim());
    }
  }

  // Scan pie segments by hovering
  const tooltipSet = new Set();
  for (const rFactor of radii) {
    const r = Math.min(box.width, box.height) / 2 * rFactor;
    for (let deg = 0; deg < 360; deg += angleStep) {
      const rad = deg * Math.PI / 180;
      await page.mouse.move(cx + r * Math.cos(rad), cy + r * Math.sin(rad));
      await page.waitForTimeout(hoverDelay);

      const tips = await page.evaluate((sel) => {
        const els = document.querySelectorAll(sel);
        return Array.from(els)
          .filter(e => e.offsetParent !== null && e.textContent.trim())
          .map(e => e.textContent.trim());
      }, tooltipSelector);

      tips.forEach(t => tooltipSet.add(t));
    }
  }

  // Move mouse away to clear tooltip
  await page.mouse.move(0, 0);

  const rawTooltips = Array.from(tooltipSet);

  // Parse tooltips — common formats:
  // "LabelCount(Percentage%)" e.g., "Unassigned200(97.09%)"
  // "Label: Count (Percentage%)" e.g., "Unassigned: 200 (97.09%)"
  const parsed = rawTooltips.map(raw => {
    // Try format: "Label Count (Percentage%)" or "LabelCount(Percentage%)"
    const match = raw.match(/^(.+?)(\d[\d,]*(?:\.\d+)?)\s*\((\d+(?:\.\d+)?)%\)$/);
    if (match) {
      return {
        label: match[1].trim(),
        value: match[2],
        percentage: match[3] + '%',
      };
    }
    // Try format with colon: "Label: Count (Percentage%)"
    const match2 = raw.match(/^(.+?):\s*(\d[\d,]*(?:\.\d+)?)\s*\((\d+(?:\.\d+)?)%\)$/);
    if (match2) {
      return {
        label: match2[1].trim(),
        value: match2[2],
        percentage: match2[3] + '%',
      };
    }
    // Fallback — return raw text
    return { label: raw, value: '', percentage: '' };
  });

  return {
    legends,
    tooltips: parsed,
    raw: rawTooltips,
    segmentsFound: parsed.length,
  };
}

module.exports = { scan };
