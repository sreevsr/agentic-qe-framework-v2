/**
 * component-detector.js — Detects UI component library and widget type from DOM.
 *
 * Runs inside page.evaluate() — reads class names, attributes, and DOM structure
 * to identify which component library rendered the element and what type of
 * widget it is (Select, Autocomplete, DatePicker, etc.).
 *
 * Returns: { library, widget, wrapperSelector, meta }
 * Returns null if the element is a standard HTML control (no special handling needed).
 *
 * DO NOT convert to .ts — loaded as raw string via fs.readFileSync.
 */

(function(args) {
  var selector = args.selector;
  var el = document.querySelector(selector);
  if (!el) return null;

  // Walk up to find the component root (max 5 levels)
  var candidates = [el];
  var cur = el;
  for (var i = 0; i < 5; i++) {
    cur = cur.parentElement;
    if (!cur || cur === document.body) break;
    candidates.push(cur);
  }

  // Check each candidate for known component library signatures
  for (var ci = 0; ci < candidates.length; ci++) {
    var node = candidates[ci];
    var cls = node.className || "";
    if (typeof cls !== "string") cls = cls.toString();
    var role = node.getAttribute("role") || "";

    // === MUI (Material UI) ===

    // MUI Select — must have MuiSelect class OR a mui-component-select display element
    // Do NOT match on MuiInputBase alone — that also matches plain MUI TextFields
    var hasMuiSelect = cls.indexOf("MuiSelect") !== -1;
    var hasSelectDisplay = node.querySelector("[id^='mui-component-select']") !== null;
    if (!hasMuiSelect && !hasSelectDisplay) {
      // Check ancestors too
      hasMuiSelect = findAncestorWithClass(el, "MuiSelect") !== null;
    }
    if (hasMuiSelect || hasSelectDisplay) {
      var wrapper = findAncestorWithClass(el, "MuiInputBase-root") || findAncestorWithClass(el, "MuiFormControl-root");
      var selectDisplay = node.querySelector("[id^='mui-component-select']") || el;
      return {
        library: "mui",
        widget: "select",
        wrapperSelector: wrapper ? uniqueSelector(wrapper) : selector,
        displaySelector: selectDisplay ? uniqueSelector(selectDisplay) : null,
        meta: {
          currentValue: selectDisplay ? selectDisplay.textContent.trim() : null,
          menuSelector: ".MuiMenu-paper .MuiList-root",
          optionSelector: ".MuiMenuItem-root",
          optionRole: "option"
        }
      };
    }

    // MUI Autocomplete
    if (cls.indexOf("MuiAutocomplete") !== -1) {
      var input = node.querySelector("input") || el;
      return {
        library: "mui",
        widget: "autocomplete",
        wrapperSelector: uniqueSelector(node),
        inputSelector: input ? uniqueSelector(input) : null,
        meta: {
          listboxSelector: "[role='listbox']",
          optionSelector: "[role='option']",
          clearSelector: ".MuiAutocomplete-clearIndicator"
        }
      };
    }

    // MUI DatePicker
    if (cls.indexOf("MuiDatePicker") !== -1 || cls.indexOf("MuiPickersDay") !== -1 ||
        (cls.indexOf("MuiTextField") !== -1 && node.querySelector("input[type='date'], input[placeholder*='mm/dd'], input[placeholder*='MM/DD']"))) {
      var dateInput = node.querySelector("input") || el;
      return {
        library: "mui",
        widget: "datepicker",
        wrapperSelector: uniqueSelector(node),
        inputSelector: dateInput ? uniqueSelector(dateInput) : null,
        meta: {
          calendarSelector: ".MuiDateCalendar-root, .MuiCalendarPicker-root",
          openButtonSelector: ".MuiInputAdornment-root button"
        }
      };
    }

    // MUI DataGrid
    if (cls.indexOf("MuiDataGrid") !== -1) {
      return {
        library: "mui",
        widget: "datagrid",
        wrapperSelector: uniqueSelector(node),
        meta: {
          rowSelector: ".MuiDataGrid-row",
          cellSelector: ".MuiDataGrid-cell",
          headerSelector: ".MuiDataGrid-columnHeader"
        }
      };
    }

    // MUI IconButton (common for filter toggles, close buttons)
    if (cls.indexOf("MuiIconButton") !== -1) {
      return {
        library: "mui",
        widget: "iconbutton",
        wrapperSelector: uniqueSelector(node),
        meta: {
          title: node.getAttribute("title") || null,
          ariaLabel: node.getAttribute("aria-label") || null
        }
      };
    }

    // === Ant Design ===

    if (cls.indexOf("ant-select") !== -1) {
      var antWrapper = findAncestorWithClass(el, "ant-select") || node;
      return {
        library: "antd",
        widget: "select",
        wrapperSelector: uniqueSelector(antWrapper),
        meta: {
          optionSelector: ".ant-select-item-option",
          dropdownSelector: ".ant-select-dropdown"
        }
      };
    }

    // === Kendo UI ===

    if (cls.indexOf("k-dropdown") !== -1 || cls.indexOf("k-combobox") !== -1 || node.getAttribute("data-role") === "dropdownlist") {
      var kendoWrapper = findAncestorWithClass(el, "k-dropdown") || findAncestorWithClass(el, "k-combobox") || node;
      return {
        library: "kendo",
        widget: "select",
        wrapperSelector: uniqueSelector(kendoWrapper),
        meta: {
          optionSelector: ".k-item, li.k-list-item",
          dropdownSelector: ".k-animation-container, .k-list-container"
        }
      };
    }

    // === Fluent UI (Microsoft) ===

    if (cls.indexOf("ms-Dropdown") !== -1 || cls.indexOf("fui-Dropdown") !== -1) {
      var fluentWrapper = findAncestorWithClass(el, "ms-Dropdown") || findAncestorWithClass(el, "fui-Dropdown") || node;
      return {
        library: "fluent",
        widget: "select",
        wrapperSelector: uniqueSelector(fluentWrapper),
        meta: {
          optionSelector: ".ms-Dropdown-item, [role='option']",
          dropdownSelector: ".ms-Dropdown-items, [role='listbox']"
        }
      };
    }
  }

  // No known component library detected — standard HTML
  return null;

  // --- Helpers ---

  function findAncestorWithClass(el, className) {
    var cur = el;
    while (cur && cur !== document.body) {
      if (cur.className && typeof cur.className === "string" && cur.className.indexOf(className) !== -1) return cur;
      cur = cur.parentElement;
    }
    return null;
  }

  function uniqueSelector(el) {
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
})
