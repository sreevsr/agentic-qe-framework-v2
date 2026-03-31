/**
 * page-scanner.ts — Scans the visible DOM and produces multi-signal fingerprints
 * for every interactive element.
 *
 * Runs entirely via page.evaluate() — works on any app regardless of CSP,
 * framework (React/Angular/Vue/MUI/Fluent), or security policy.
 *
 * Output: compact element list with fingerprints that the fingerprint-resolver
 * can use to re-identify elements during replay.
 *
 * IMPORTANT: The browser-side scan logic is defined as a string constant
 * (BROWSER_SCAN_FN) to avoid tsx/esbuild injecting __name helpers that
 * don't exist inside page.evaluate's browser context.
 */

import { Page } from 'playwright';

// --- Types ---

export interface ElementFingerprint {
  // Tier 1: Stable identifiers (instant match if present)
  id?: string;
  testId?: string;

  // Tier 2: Semantic identity (what the element IS)
  text?: string;           // visible text content (trimmed, max 100 chars)
  ariaLabel?: string;      // aria-label attribute
  placeholder?: string;
  name?: string;           // form element name attribute
  title?: string;
  href?: string;           // for links (pathname only, no domain)

  // Tier 3: Type signals
  tag: string;             // actual DOM tag (lowercase)
  role?: string;           // explicit [role] attribute only (not inferred)
  inputType?: string;      // input type attribute

  // Tier 4: Structural disambiguation (WHICH instance)
  cssPath: string;         // unique selector path from root
  nearestIdAncestor?: string; // closest ancestor with an ID (e.g., "#sidebar")
  parentTag?: string;      // immediate parent's tag
  parentText?: string;     // nearest ancestor with short meaningful text
  siblingIndex: number;    // 0-based index among same-tag siblings

  // Tier 5: Visual position (session-stable, viewport-dependent)
  rect: { x: number; y: number; w: number; h: number };
  visible: boolean;
}

export interface ScannedElement {
  idx: number;
  fingerprint: ElementFingerprint;
  /** One-line summary for LLM display (e.g., "[3] button 'Submit' #submit-btn") */
  label: string;
}

export interface ScanResult {
  url: string;
  title: string;
  viewport: { width: number; height: number };
  elements: ScannedElement[];
  scanDurationMs: number;
}

// --- Browser-side scan function (as string to avoid tsx __name injection) ---

/* eslint-disable no-template-curly-in-string */
const BROWSER_SCAN_FN = [
  'function() {',
  '  function getUniqueCssSelector(el) {',
  '    if (el.id) {',
  '      var escaped = CSS.escape(el.id);',
  '      if (document.querySelectorAll("#" + escaped).length === 1) return "#" + escaped;',
  '    }',
  '    var testId = el.getAttribute("data-testid") || el.getAttribute("data-test-id");',
  '    if (testId) {',
  '      var sel = "[data-testid=\\"" + CSS.escape(testId) + "\\"]";',
  '      if (document.querySelectorAll(sel).length === 1) return sel;',
  '    }',
  '    var parts = [];',
  '    var cur = el;',
  '    while (cur && cur !== document.documentElement) {',
  '      var seg = cur.tagName.toLowerCase();',
  '      if (cur.id && cur !== el) {',
  '        var esc = CSS.escape(cur.id);',
  '        if (document.querySelectorAll("#" + esc).length === 1) { parts.unshift("#" + esc); break; }',
  '      }',
  '      var par = cur.parentElement;',
  '      if (par) {',
  '        var sibs = Array.from(par.children).filter(function(s) { return s.tagName === cur.tagName; });',
  '        if (sibs.length > 1) seg += ":nth-of-type(" + (sibs.indexOf(cur) + 1) + ")";',
  '      }',
  '      parts.unshift(seg);',
  '      cur = par;',
  '      var cand = parts.join(" > ");',
  '      try { if (document.querySelectorAll(cand).length === 1) return cand; } catch(e) {}',
  '    }',
  '    return parts.join(" > ");',
  '  }',
  '',
  '  function getVisibleText(el, maxLen) {',
  '    maxLen = maxLen || 100;',
  '    var label = el.getAttribute("aria-label");',
  '    if (label) return label.trim().substring(0, maxLen);',
  '    var direct = Array.from(el.childNodes)',
  '      .filter(function(n) { return n.nodeType === Node.TEXT_NODE; })',
  '      .map(function(n) { return (n.textContent || "").trim(); })',
  '      .filter(Boolean)',
  '      .join(" ").trim();',
  '    if (direct) return direct.substring(0, maxLen);',
  '    return (el.textContent || "").trim().substring(0, maxLen);',
  '  }',
  '',
  '  function getNearestIdAncestor(el) {',
  '    var cur = el.parentElement;',
  '    while (cur && cur !== document.documentElement) {',
  '      if (cur.id) return "#" + cur.id;',
  '      cur = cur.parentElement;',
  '    }',
  '    return undefined;',
  '  }',
  '',
  '  function getParentText(el, maxLen) {',
  '    maxLen = maxLen || 60;',
  '    var cur = el.parentElement;',
  '    var depth = 0;',
  '    while (cur && cur !== document.body && depth < 3) {',
  '      var txt = Array.from(cur.childNodes)',
  '        .filter(function(n) { return n.nodeType === Node.TEXT_NODE; })',
  '        .map(function(n) { return (n.textContent || "").trim(); })',
  '        .filter(Boolean)',
  '        .join(" ").trim();',
  '      if (txt && txt.length > 2 && txt.length < maxLen) return txt;',
  '      cur = cur.parentElement;',
  '      depth++;',
  '    }',
  '    return undefined;',
  '  }',
  '',
  '  function getSiblingIndex(el) {',
  '    var parent = el.parentElement;',
  '    if (!parent) return 0;',
  '    var sibs = Array.from(parent.children).filter(function(s) { return s.tagName === el.tagName; });',
  '    return sibs.indexOf(el);',
  '  }',
  '',
  '  var INTERACTIVE = "a[href],button,input,select,textarea,' +
    '[role=button],[role=link],[role=menuitem],[role=tab],' +
    '[role=checkbox],[role=radio],[role=switch],[role=combobox],' +
    '[role=option],[role=listbox],[role=slider],[role=spinbutton],' +
    '[role=textbox],[onclick],[tabindex]:not([tabindex=\\"-1\\"]),label[for],summary";',
  '',
  '  var elements = document.querySelectorAll(INTERACTIVE);',
  '  var results = [];',
  '',
  '  for (var i = 0; i < elements.length; i++) {',
  '    var el = elements[i];',
  '    var rect = el.getBoundingClientRect();',
  '    var visible = rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.right > 0 && el.offsetParent !== null;',
  '    if (!visible) continue;',
  '',
  '    var centerX = rect.left + rect.width / 2;',
  '    var centerY = rect.top + rect.height / 2;',
  '    var topEl = document.elementFromPoint(centerX, centerY);',
  '    var isCovered = topEl !== null && topEl !== el && !el.contains(topEl) && !topEl.contains(el);',
  '',
  '    var text = getVisibleText(el);',
  '    var tag = el.tagName.toLowerCase();',
  '    var href = el.getAttribute("href");',
  '    var hrefPath = undefined;',
  '    if (href) { try { hrefPath = new URL(href, location.origin).pathname; } catch(e) { hrefPath = href; } }',
  '',
  '    var parent = el.parentElement;',
  '    results.push({',
  '      tag: tag,',
  '      id: el.id || undefined,',
  '      testId: el.getAttribute("data-testid") || el.getAttribute("data-test-id") || undefined,',
  '      text: text || undefined,',
  '      ariaLabel: el.getAttribute("aria-label") || undefined,',
  '      placeholder: el.getAttribute("placeholder") || undefined,',
  '      name: el.getAttribute("name") || undefined,',
  '      title: el.getAttribute("title") || undefined,',
  '      href: hrefPath,',
  '      role: el.getAttribute("role") || undefined,',
  '      inputType: tag === "input" ? (el.type || "text") : undefined,',
  '      cssPath: getUniqueCssSelector(el),',
  '      nearestIdAncestor: getNearestIdAncestor(el),',
  '      parentTag: parent ? parent.tagName.toLowerCase() : undefined,',
  '      parentText: getParentText(el),',
  '      siblingIndex: getSiblingIndex(el),',
  '      rect: { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) },',
  '      visible: !isCovered',
  '    });',
  '  }',
  '',
  '  return {',
  '    url: location.href,',
  '    title: document.title,',
  '    viewport: { width: window.innerWidth, height: window.innerHeight },',
  '    elements: results',
  '  };',
  '}',
].join('\n');

// --- Scanner ---

/**
 * Scan the current page for all interactive elements.
 * Returns a compact, fingerprinted element list.
 *
 * Fast: typically <50ms even on heavy enterprise DOMs.
 * Safe: uses page.evaluate (CDP Runtime.evaluate), bypasses CSP.
 */
export async function scanPage(page: Page): Promise<ScanResult> {
  const start = Date.now();

  const scanResult: any = await page.evaluate(`(${BROWSER_SCAN_FN})()`);

  const elements: ScannedElement[] = scanResult.elements.map((el: any, idx: number) => {
    const parts: string[] = [`[${idx}]`, el.tag];
    if (el.role) parts.push(`role=${el.role}`);
    if (el.inputType) parts.push(`type=${el.inputType}`);
    if (el.text) parts.push(`"${el.text.substring(0, 40)}"`);
    if (el.ariaLabel && el.ariaLabel !== el.text)
      parts.push(`label="${el.ariaLabel.substring(0, 40)}"`);
    if (el.id) parts.push(`#${el.id}`);
    if (el.testId) parts.push(`testid=${el.testId}`);
    if (el.placeholder) parts.push(`placeholder="${el.placeholder}"`);
    if (!el.visible) parts.push('(covered)');

    return {
      idx,
      fingerprint: el as ElementFingerprint,
      label: parts.join(' '),
    };
  });

  return {
    url: scanResult.url,
    title: scanResult.title,
    viewport: scanResult.viewport,
    elements,
    scanDurationMs: Date.now() - start,
  };
}

/**
 * Format scan results as a compact string for LLM consumption.
 * Designed to minimize tokens while remaining readable.
 */
export function formatScanForLLM(scan: ScanResult): string {
  const lines: string[] = [
    `Page: ${scan.title} (${scan.url})`,
    `Elements (${scan.elements.length}):`,
  ];

  for (const el of scan.elements) {
    lines.push(`  ${el.label}`);
  }

  return lines.join('\n');
}
