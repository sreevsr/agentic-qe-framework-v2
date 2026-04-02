/**
 * browser-scan.js — Browser-side DOM scanning function.
 *
 * This is a PLAIN JavaScript file (not TypeScript) loaded at runtime via fs.readFileSync.
 * It is NEVER processed by tsx/esbuild, so it will never get __name helpers injected.
 *
 * The function scans all visible interactive elements and returns multi-signal fingerprints.
 * It runs inside page.evaluate() via CDP — bypasses CSP, works on any framework.
 *
 * DO NOT convert this to .ts — the whole point is to avoid TypeScript compilation.
 * DO NOT import this — it is read as a raw string and passed to page.evaluate().
 */

// This IIFE is evaluated as a string inside page.evaluate()
(function() {
  function getUniqueCssSelector(el) {
    if (el.id) {
      var escaped = CSS.escape(el.id);
      if (document.querySelectorAll("#" + escaped).length === 1) return "#" + escaped;
    }
    var testId = el.getAttribute("data-testid") || el.getAttribute("data-test-id");
    if (testId) {
      var sel = "[data-testid=\"" + CSS.escape(testId) + "\"]";
      if (document.querySelectorAll(sel).length === 1) return sel;
    }
    var parts = [];
    var cur = el;
    while (cur && cur !== document.documentElement) {
      var seg = cur.tagName.toLowerCase();
      if (cur.id && cur !== el) {
        var esc = CSS.escape(cur.id);
        if (document.querySelectorAll("#" + esc).length === 1) { parts.unshift("#" + esc); break; }
      }
      var par = cur.parentElement;
      if (par) {
        var sibs = Array.from(par.children).filter(function(s) { return s.tagName === cur.tagName; });
        if (sibs.length > 1) seg += ":nth-of-type(" + (sibs.indexOf(cur) + 1) + ")";
      }
      parts.unshift(seg);
      cur = par;
      var cand = parts.join(" > ");
      try { if (document.querySelectorAll(cand).length === 1) return cand; } catch(e) {}
    }
    return parts.join(" > ");
  }

  function getVisibleText(el, maxLen) {
    maxLen = maxLen || 100;
    var label = el.getAttribute("aria-label");
    if (label) return label.trim().substring(0, maxLen);
    var direct = Array.from(el.childNodes)
      .filter(function(n) { return n.nodeType === Node.TEXT_NODE; })
      .map(function(n) { return (n.textContent || "").trim(); })
      .filter(Boolean)
      .join(" ").trim();
    if (direct) return direct.substring(0, maxLen);
    return (el.textContent || "").trim().substring(0, maxLen);
  }

  function getNearestIdAncestor(el) {
    var cur = el.parentElement;
    while (cur && cur !== document.documentElement) {
      if (cur.id) return "#" + cur.id;
      cur = cur.parentElement;
    }
    return undefined;
  }

  function getParentText(el, maxLen) {
    maxLen = maxLen || 60;
    var cur = el.parentElement;
    var depth = 0;
    while (cur && cur !== document.body && depth < 3) {
      var txt = Array.from(cur.childNodes)
        .filter(function(n) { return n.nodeType === Node.TEXT_NODE; })
        .map(function(n) { return (n.textContent || "").trim(); })
        .filter(Boolean)
        .join(" ").trim();
      if (txt && txt.length > 2 && txt.length < maxLen) return txt;
      cur = cur.parentElement;
      depth++;
    }
    return undefined;
  }

  function getSiblingIndex(el) {
    var parent = el.parentElement;
    if (!parent) return 0;
    var sibs = Array.from(parent.children).filter(function(s) { return s.tagName === el.tagName; });
    return sibs.indexOf(el);
  }

  var INTERACTIVE = "a[href],button,input,select,textarea," +
    "[role=button],[role=link],[role=menuitem],[role=tab]," +
    "[role=checkbox],[role=radio],[role=switch],[role=combobox]," +
    "[role=option],[role=listbox],[role=slider],[role=spinbutton]," +
    "[role=textbox],[onclick],[tabindex]:not([tabindex=\"-1\"]),label[for],summary";

  var elements = document.querySelectorAll(INTERACTIVE);
  var results = [];

  for (var i = 0; i < elements.length; i++) {
    var el = elements[i];
    var rect = el.getBoundingClientRect();
    // offsetParent is null for both hidden elements AND position:fixed elements.
    // Only call getComputedStyle (expensive) when offsetParent is null to distinguish.
    var hasSize = rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.right > 0;
    var isFixed = el.offsetParent === null && hasSize ? window.getComputedStyle(el).position === "fixed" : false;
    var visible = hasSize && (el.offsetParent !== null || isFixed);
    if (!visible) continue;

    var centerX = rect.left + rect.width / 2;
    var centerY = rect.top + rect.height / 2;
    var topEl = document.elementFromPoint(centerX, centerY);
    var isCovered = topEl !== null && topEl !== el && !el.contains(topEl) && !topEl.contains(el);

    var text = getVisibleText(el);
    var tag = el.tagName.toLowerCase();
    var href = el.getAttribute("href");
    var hrefPath = undefined;
    if (href) { try { hrefPath = new URL(href, location.origin).pathname; } catch(e) { hrefPath = href; } }

    var parent = el.parentElement;
    results.push({
      tag: tag,
      id: el.id || undefined,
      testId: el.getAttribute("data-testid") || el.getAttribute("data-test-id") || undefined,
      text: text || undefined,
      ariaLabel: el.getAttribute("aria-label") || undefined,
      placeholder: el.getAttribute("placeholder") || undefined,
      name: el.getAttribute("name") || undefined,
      title: el.getAttribute("title") || undefined,
      href: hrefPath,
      role: el.getAttribute("role") || undefined,
      inputType: tag === "input" ? (el.type || "text") : undefined,
      cssPath: getUniqueCssSelector(el),
      nearestIdAncestor: getNearestIdAncestor(el),
      parentTag: parent ? parent.tagName.toLowerCase() : undefined,
      parentText: getParentText(el),
      siblingIndex: getSiblingIndex(el),
      rect: { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) },
      visible: !isCovered
    });
  }

  return {
    url: location.href,
    title: document.title,
    viewport: { width: window.innerWidth, height: window.innerHeight },
    elements: results
  };
})()
