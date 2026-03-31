/**
 * fingerprint-resolver.ts — Multi-signal element matching with self-healing.
 *
 * Tiered resolution:
 *   Tier 1: Direct match (id, testId, cssPath)         <10ms   — exact selector hit
 *   Tier 2: Self-heal (scan DOM, score candidates)      ~100ms  — element moved/renamed
 *   Tier 3: (future) Visual fallback via OCR+coords     ~2s     — DOM restructured
 *
 * Scoring algorithm inspired by Healenium's LCS approach:
 *   - Multiple signals are scored independently
 *   - Weights reflect signal stability (text > position, id > class)
 *   - Visibility and coverage get bonus points
 *   - Highest-scoring candidate wins if above confidence threshold
 */

import { Page, Locator } from 'playwright';
import { ElementFingerprint } from './page-scanner';

// --- Types ---

export interface FingerprintMatch {
  locator: Locator;
  strategy: string;          // human-readable description of how matched
  confidence: number;        // 0-100 score
  tier: 1 | 2 | 3;          // which resolution tier succeeded
  healed: boolean;           // true if element was found via self-healing (not exact match)
  healingDetails?: string;   // what changed (for diagnostics)
}

interface ScoredCandidate {
  cssPath: string;
  score: number;
  breakdown: string[];       // per-signal scoring details
  visible: boolean;
}

// --- Configuration ---

const WEIGHTS = {
  id: 100, testId: 100,
  text: 30, ariaLabel: 25, placeholder: 20, name: 15, title: 10, href: 15,
  tag: 10, role: 10, inputType: 8,
  nearestIdAncestor: 12, parentTag: 5, parentText: 10, siblingIndex: 5,
  visibleBonus: 15, positionBonus: 10, positionCloseBonus: 5,
};

const HEALING_CONFIDENCE_THRESHOLD = 40;
const MAX_CANDIDATES = 200;

// --- Browser-side candidate scan (as string to avoid tsx __name issue) ---

const BROWSER_CANDIDATE_SCAN_FN = [
  'function(args) {',
  '  var fingerprint = args.fingerprint;',
  '  var maxCandidates = args.maxCandidates;',
  '  var tag = fingerprint.tag;',
  '  var selectors = [];',
  '  if (tag) selectors.push(tag);',
  '  if (["a","button","input","select","textarea"].indexOf(tag) === -1) {',
  '    selectors.push("a","button","input","select","textarea");',
  '  }',
  '  if (fingerprint.role) selectors.push("[role=\\"" + fingerprint.role + "\\"]");',
  '',
  '  var seen = new Set();',
  '  var results = [];',
  '',
  '  function quickCssPath(el) {',
  '    if (el.id) {',
  '      var esc = CSS.escape(el.id);',
  '      if (document.querySelectorAll("#" + esc).length === 1) return "#" + esc;',
  '    }',
  '    var parts = [];',
  '    var cur = el;',
  '    while (cur && cur !== document.documentElement) {',
  '      var seg = cur.tagName.toLowerCase();',
  '      if (cur.id) {',
  '        var esc2 = CSS.escape(cur.id);',
  '        if (document.querySelectorAll("#" + esc2).length === 1) { parts.unshift("#" + esc2); break; }',
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
  '  for (var si = 0; si < selectors.length; si++) {',
  '    try {',
  '      var elements = document.querySelectorAll(selectors[si]);',
  '      for (var ei = 0; ei < elements.length; ei++) {',
  '        var el = elements[ei];',
  '        if (seen.has(el) || results.length >= maxCandidates) continue;',
  '        seen.add(el);',
  '        var rect = el.getBoundingClientRect();',
  '        if (rect.width === 0 && rect.height === 0) continue;',
  '        var visible = rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.right > 0 && el.offsetParent !== null;',
  '',
  '        var directText = Array.from(el.childNodes)',
  '          .filter(function(n) { return n.nodeType === Node.TEXT_NODE; })',
  '          .map(function(n) { return (n.textContent || "").trim(); })',
  '          .filter(Boolean).join(" ").trim();',
  '        var text = directText || (el.textContent || "").trim().substring(0, 100);',
  '',
  '        var nearestIdAncestor = undefined;',
  '        var p = el.parentElement;',
  '        while (p && p !== document.documentElement) {',
  '          if (p.id) { nearestIdAncestor = "#" + p.id; break; }',
  '          p = p.parentElement;',
  '        }',
  '',
  '        var parent = el.parentElement;',
  '        var siblingIndex = 0;',
  '        if (parent) {',
  '          var sbs = Array.from(parent.children).filter(function(s) { return s.tagName === el.tagName; });',
  '          siblingIndex = sbs.indexOf(el);',
  '        }',
  '',
  '        var parentText = undefined;',
  '        var pp = el.parentElement;',
  '        var depth = 0;',
  '        while (pp && pp !== document.body && depth < 3) {',
  '          var pt = Array.from(pp.childNodes)',
  '            .filter(function(n) { return n.nodeType === Node.TEXT_NODE; })',
  '            .map(function(n) { return (n.textContent || "").trim(); })',
  '            .filter(Boolean).join(" ").trim();',
  '          if (pt && pt.length > 2 && pt.length < 60) { parentText = pt; break; }',
  '          pp = pp.parentElement;',
  '          depth++;',
  '        }',
  '',
  '        var href = el.getAttribute("href");',
  '        var hrefPath = undefined;',
  '        if (href) { try { hrefPath = new URL(href, location.origin).pathname; } catch(e) { hrefPath = href; } }',
  '',
  '        results.push({',
  '          tag: el.tagName.toLowerCase(),',
  '          id: el.id || undefined,',
  '          testId: el.getAttribute("data-testid") || el.getAttribute("data-test-id") || undefined,',
  '          text: text || undefined,',
  '          ariaLabel: el.getAttribute("aria-label") || undefined,',
  '          placeholder: el.getAttribute("placeholder") || undefined,',
  '          name: el.getAttribute("name") || undefined,',
  '          title: el.getAttribute("title") || undefined,',
  '          href: hrefPath,',
  '          role: el.getAttribute("role") || undefined,',
  '          inputType: el.tagName === "INPUT" ? (el.type || "text") : undefined,',
  '          cssPath: quickCssPath(el),',
  '          nearestIdAncestor: nearestIdAncestor,',
  '          parentTag: parent ? parent.tagName.toLowerCase() : undefined,',
  '          parentText: parentText,',
  '          siblingIndex: siblingIndex,',
  '          rect: { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) },',
  '          visible: visible',
  '        });',
  '      }',
  '    } catch(e) {}',
  '  }',
  '  return results;',
  '}',
].join('\n');

// --- Main Resolution ---

/**
 * Resolve an element using its stored fingerprint.
 * Tries direct match first, then self-heals by scanning the DOM.
 */
export async function resolveByFingerprint(
  page: Page,
  fingerprint: ElementFingerprint,
  timeout: number = 5000,
): Promise<FingerprintMatch | null> {
  // Tier 1: Direct match — try exact selectors
  const tier1 = await tryDirectMatch(page, fingerprint, timeout);
  if (tier1) return tier1;

  // Tier 2: Self-heal — scan DOM and score candidates
  const tier2 = await trySelfHeal(page, fingerprint, timeout);
  if (tier2) return tier2;

  return null;
}

// --- Tier 1: Direct Match ---

async function tryDirectMatch(
  page: Page,
  fp: ElementFingerprint,
  timeout: number,
): Promise<FingerprintMatch | null> {
  const attempts: Array<{ selector: string; strategy: string }> = [];

  if (fp.id) {
    attempts.push({ selector: `#${cssEscape(fp.id)}`, strategy: `id:#${fp.id}` });
  }
  if (fp.testId) {
    attempts.push({ selector: `[data-testid="${fp.testId}"]`, strategy: `testId:${fp.testId}` });
    attempts.push({ selector: `[data-test-id="${fp.testId}"]`, strategy: `test-id:${fp.testId}` });
  }
  if (fp.cssPath) {
    attempts.push({ selector: fp.cssPath, strategy: `cssPath:${truncate(fp.cssPath, 60)}` });
  }

  for (const { selector, strategy } of attempts) {
    try {
      const locator = page.locator(selector);
      const count = await locator.count();

      if (count === 1) {
        return {
          locator,
          strategy: `tier1:${strategy}`,
          confidence: 100,
          tier: 1,
          healed: false,
        };
      }

      if (count > 1) {
        // Multiple matches — try first visible
        for (let i = 0; i < Math.min(count, 10); i++) {
          const nth = locator.nth(i);
          if (await nth.isVisible().catch(() => false)) {
            return {
              locator: nth,
              strategy: `tier1:${strategy}:visible.nth(${i})`,
              confidence: 90,
              tier: 1,
              healed: false,
            };
          }
        }
      }
    } catch {
      // Invalid selector, skip
    }
  }

  return null;
}

// --- Tier 2: Self-Heal ---

async function trySelfHeal(
  page: Page,
  fp: ElementFingerprint,
  timeout: number,
): Promise<FingerprintMatch | null> {
  const candidates: CandidateElement[] = await page.evaluate(
    `(${BROWSER_CANDIDATE_SCAN_FN})(${JSON.stringify({ fingerprint: fp, maxCandidates: MAX_CANDIDATES })})`
  ) as any;

  if (!candidates || candidates.length === 0) return null;

  const scored = candidates.map((c) => scoreCandidate(c, fp));
  scored.sort((a, b) => b.score - a.score);

  const best = scored[0];
  if (best.score < HEALING_CONFIDENCE_THRESHOLD) return null;

  const locator = page.locator(best.cssPath);
  const count = await locator.count().catch(() => 0);
  if (count === 0) return null;

  const healingDetails = buildHealingReport(fp, best);

  return {
    locator: count > 1 ? locator.first() : locator,
    strategy: `tier2:self-healed(${best.score}pts) [${best.breakdown.slice(0, 3).join(', ')}]`,
    confidence: Math.min(best.score, 100),
    tier: 2,
    healed: true,
    healingDetails,
  };
}

type CandidateElement = ElementFingerprint;

// --- Scoring ---

function scoreCandidate(candidate: CandidateElement, fp: ElementFingerprint): ScoredCandidate {
  let score = 0;
  const breakdown: string[] = [];

  // Tier 1 signals
  if (fp.id && candidate.id && fp.id === candidate.id) {
    score += WEIGHTS.id; breakdown.push(`id:+${WEIGHTS.id}`);
  }
  if (fp.testId && candidate.testId && fp.testId === candidate.testId) {
    score += WEIGHTS.testId; breakdown.push(`testId:+${WEIGHTS.testId}`);
  }

  // Tier 2 signals (semantic identity)
  if (fp.text && candidate.text) {
    if (fp.text === candidate.text) {
      score += WEIGHTS.text; breakdown.push(`text:+${WEIGHTS.text}(exact)`);
    } else if (candidate.text.includes(fp.text) || fp.text.includes(candidate.text)) {
      const pts = Math.round(WEIGHTS.text * 0.7);
      score += pts; breakdown.push(`text:+${pts}(partial)`);
    } else if (normalizeText(fp.text) === normalizeText(candidate.text)) {
      const pts = Math.round(WEIGHTS.text * 0.5);
      score += pts; breakdown.push(`text:+${pts}(norm)`);
    }
  }

  if (fp.ariaLabel && candidate.ariaLabel) {
    if (fp.ariaLabel === candidate.ariaLabel) {
      score += WEIGHTS.ariaLabel; breakdown.push(`label:+${WEIGHTS.ariaLabel}`);
    } else if (normalizeText(fp.ariaLabel) === normalizeText(candidate.ariaLabel)) {
      const pts = Math.round(WEIGHTS.ariaLabel * 0.7);
      score += pts; breakdown.push(`label:+${pts}(norm)`);
    }
  }

  if (fp.placeholder && candidate.placeholder && fp.placeholder === candidate.placeholder) {
    score += WEIGHTS.placeholder; breakdown.push(`ph:+${WEIGHTS.placeholder}`);
  }
  if (fp.name && candidate.name && fp.name === candidate.name) {
    score += WEIGHTS.name; breakdown.push(`name:+${WEIGHTS.name}`);
  }
  if (fp.title && candidate.title && fp.title === candidate.title) {
    score += WEIGHTS.title; breakdown.push(`title:+${WEIGHTS.title}`);
  }
  if (fp.href && candidate.href && fp.href === candidate.href) {
    score += WEIGHTS.href; breakdown.push(`href:+${WEIGHTS.href}`);
  }

  // Tier 3 signals (type)
  if (fp.tag && candidate.tag && fp.tag === candidate.tag) {
    score += WEIGHTS.tag; breakdown.push(`tag:+${WEIGHTS.tag}`);
  }
  if (fp.role && candidate.role && fp.role === candidate.role) {
    score += WEIGHTS.role; breakdown.push(`role:+${WEIGHTS.role}`);
  }
  if (fp.inputType && candidate.inputType && fp.inputType === candidate.inputType) {
    score += WEIGHTS.inputType; breakdown.push(`type:+${WEIGHTS.inputType}`);
  }

  // Tier 4 signals (structural)
  if (fp.nearestIdAncestor && candidate.nearestIdAncestor && fp.nearestIdAncestor === candidate.nearestIdAncestor) {
    score += WEIGHTS.nearestIdAncestor; breakdown.push(`ancestor:+${WEIGHTS.nearestIdAncestor}`);
  }
  if (fp.parentTag && candidate.parentTag && fp.parentTag === candidate.parentTag) {
    score += WEIGHTS.parentTag; breakdown.push(`pTag:+${WEIGHTS.parentTag}`);
  }
  if (fp.parentText && candidate.parentText && fp.parentText === candidate.parentText) {
    score += WEIGHTS.parentText; breakdown.push(`pText:+${WEIGHTS.parentText}`);
  }
  if (fp.siblingIndex !== undefined && candidate.siblingIndex !== undefined && fp.siblingIndex === candidate.siblingIndex) {
    score += WEIGHTS.siblingIndex; breakdown.push(`sibIdx:+${WEIGHTS.siblingIndex}`);
  }

  // Bonuses
  if (candidate.visible) {
    score += WEIGHTS.visibleBonus; breakdown.push(`vis:+${WEIGHTS.visibleBonus}`);
  }

  if (fp.rect && candidate.rect) {
    const dx = Math.abs(fp.rect.x - candidate.rect.x);
    const dy = Math.abs(fp.rect.y - candidate.rect.y);
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 30) {
      score += WEIGHTS.positionBonus + WEIGHTS.positionCloseBonus;
      breakdown.push(`pos:+${WEIGHTS.positionBonus + WEIGHTS.positionCloseBonus}`);
    } else if (dist < 100) {
      score += WEIGHTS.positionBonus;
      breakdown.push(`pos:+${WEIGHTS.positionBonus}`);
    }
  }

  return { cssPath: candidate.cssPath, score, breakdown, visible: candidate.visible };
}

// --- Healing Report ---

function buildHealingReport(fp: ElementFingerprint, best: ScoredCandidate): string {
  const changes: string[] = [];
  if (fp.cssPath !== best.cssPath) {
    changes.push(`cssPath: "${truncate(fp.cssPath, 50)}" -> "${truncate(best.cssPath, 50)}"`);
  }
  if (changes.length === 0) {
    changes.push('Element found at same location with matching attributes');
  }
  return [
    `Self-healed with ${best.score}pts`,
    `Signals: ${best.breakdown.join(', ')}`,
    ...changes,
  ].join('\n');
}

// --- Utilities ---

function normalizeText(text: string): string {
  return text.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
}

function cssEscape(value: string): string {
  return value.replace(/([^\w-])/g, '\\$1');
}

function truncate(str: string, max: number): string {
  return str.length > max ? str.substring(0, max) + '...' : str;
}
