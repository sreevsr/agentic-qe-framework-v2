/**
 * browser-candidate-scan.js — Browser-side candidate element scanner for self-healing.
 *
 * PLAIN JavaScript file loaded at runtime via fs.readFileSync.
 * Never processed by tsx/esbuild — no __name injection possible.
 *
 * Takes a fingerprint object and scans the DOM for candidate elements
 * that might match it. Used by fingerprint-resolver.ts for Tier 2 self-healing.
 *
 * DO NOT convert to .ts. DO NOT import. Read as raw string.
 */

// This IIFE is evaluated as a string inside page.evaluate()
// The argument `args` is passed via string interpolation: (fn)(args)
(function(args) {
  var fingerprint = args.fingerprint;
  var maxCandidates = args.maxCandidates;
  var tag = fingerprint.tag;
  var selectors = [];
  if (tag) selectors.push(tag);
  if (["a","button","input","select","textarea"].indexOf(tag) === -1) {
    selectors.push("a","button","input","select","textarea");
  }
  if (fingerprint.role) selectors.push("[role=\"" + fingerprint.role + "\"]");

  var seen = new Set();
  var results = [];

  function quickCssPath(el) {
    if (el.id) {
      var esc = CSS.escape(el.id);
      if (document.querySelectorAll("#" + esc).length === 1) return "#" + esc;
    }
    var parts = [];
    var cur = el;
    while (cur && cur !== document.documentElement) {
      var seg = cur.tagName.toLowerCase();
      if (cur.id) {
        var esc2 = CSS.escape(cur.id);
        if (document.querySelectorAll("#" + esc2).length === 1) { parts.unshift("#" + esc2); break; }
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

  for (var si = 0; si < selectors.length; si++) {
    try {
      var elements = document.querySelectorAll(selectors[si]);
      for (var ei = 0; ei < elements.length; ei++) {
        var el = elements[ei];
        if (seen.has(el) || results.length >= maxCandidates) continue;
        seen.add(el);
        var rect = el.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) continue;
        var isFixed = window.getComputedStyle(el).position === "fixed";
        var visible = rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.right > 0 && (el.offsetParent !== null || isFixed);

        var directText = Array.from(el.childNodes)
          .filter(function(n) { return n.nodeType === Node.TEXT_NODE; })
          .map(function(n) { return (n.textContent || "").trim(); })
          .filter(Boolean).join(" ").trim();
        var text = directText || (el.textContent || "").trim().substring(0, 100);

        var nearestIdAncestor = undefined;
        var p = el.parentElement;
        while (p && p !== document.documentElement) {
          if (p.id) { nearestIdAncestor = "#" + p.id; break; }
          p = p.parentElement;
        }

        var parent = el.parentElement;
        var siblingIndex = 0;
        if (parent) {
          var sbs = Array.from(parent.children).filter(function(s) { return s.tagName === el.tagName; });
          siblingIndex = sbs.indexOf(el);
        }

        var parentText = undefined;
        var pp = el.parentElement;
        var depth = 0;
        while (pp && pp !== document.body && depth < 3) {
          var pt = Array.from(pp.childNodes)
            .filter(function(n) { return n.nodeType === Node.TEXT_NODE; })
            .map(function(n) { return (n.textContent || "").trim(); })
            .filter(Boolean).join(" ").trim();
          if (pt && pt.length > 2 && pt.length < 60) { parentText = pt; break; }
          pp = pp.parentElement;
          depth++;
        }

        var href = el.getAttribute("href");
        var hrefPath = undefined;
        if (href) { try { hrefPath = new URL(href, location.origin).pathname; } catch(e) { hrefPath = href; } }

        results.push({
          tag: el.tagName.toLowerCase(),
          id: el.id || undefined,
          testId: el.getAttribute("data-testid") || el.getAttribute("data-test-id") || undefined,
          text: text || undefined,
          ariaLabel: el.getAttribute("aria-label") || undefined,
          placeholder: el.getAttribute("placeholder") || undefined,
          name: el.getAttribute("name") || undefined,
          title: el.getAttribute("title") || undefined,
          href: hrefPath,
          role: el.getAttribute("role") || undefined,
          inputType: el.tagName === "INPUT" ? (el.type || "text") : undefined,
          cssPath: quickCssPath(el),
          nearestIdAncestor: nearestIdAncestor,
          parentTag: parent ? parent.tagName.toLowerCase() : undefined,
          parentText: parentText,
          siblingIndex: siblingIndex,
          rect: { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) },
          visible: visible
        });
      }
    } catch(e) {}
  }
  return results;
})
