/**
 * fingerprint-resolver.ts — Multi-signal element matching with self-healing.
 *
 * Tiered resolution:
 *   Tier 1: Direct match (id, testId, cssPath)         <10ms
 *   Tier 2: Self-heal (scan DOM, score candidates)      ~100ms
 *
 * Browser-side candidate scanning lives in browser-candidate-scan.js
 * (plain JS, loaded at runtime, never compiled by tsx/esbuild).
 */

import { Page, Locator } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import { ElementFingerprint } from './page-scanner';

// --- Types ---

export interface FingerprintMatch {
  locator: Locator;
  strategy: string;
  confidence: number;
  tier: 1 | 2 | 3;
  healed: boolean;
  healingDetails?: string;
}

interface ScoredCandidate {
  cssPath: string;
  score: number;
  breakdown: string[];
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

// --- Load browser script once at module init ---

const BROWSER_CANDIDATE_SCAN_SCRIPT = fs.readFileSync(
  path.join(__dirname, 'browser-candidate-scan.js'),
  'utf-8',
);

// --- Main Resolution ---

export async function resolveByFingerprint(
  page: Page,
  fingerprint: ElementFingerprint,
  timeout: number = 5000,
): Promise<FingerprintMatch | null> {
  const tier1 = await tryDirectMatch(page, fingerprint, timeout);
  if (tier1) return tier1;

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
  // Pass args as a serialized JSON string embedded safely via page.evaluate
  // The BROWSER_CANDIDATE_SCAN_SCRIPT is an IIFE that takes args — we call it with JSON.parse
  const argsStr = JSON.stringify({ fingerprint: fp, maxCandidates: MAX_CANDIDATES });
  // Escape for safe embedding in a JS string literal (handle backslashes and quotes)
  const safeArgs = argsStr.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const candidates: CandidateElement[] = await page.evaluate(
    `(${BROWSER_CANDIDATE_SCAN_SCRIPT})(JSON.parse('${safeArgs}'))`
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

  if (fp.id && candidate.id && fp.id === candidate.id) {
    score += WEIGHTS.id; breakdown.push(`id:+${WEIGHTS.id}`);
  }
  if (fp.testId && candidate.testId && fp.testId === candidate.testId) {
    score += WEIGHTS.testId; breakdown.push(`testId:+${WEIGHTS.testId}`);
  }
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
  if (fp.tag && candidate.tag && fp.tag === candidate.tag) {
    score += WEIGHTS.tag; breakdown.push(`tag:+${WEIGHTS.tag}`);
  }
  if (fp.role && candidate.role && fp.role === candidate.role) {
    score += WEIGHTS.role; breakdown.push(`role:+${WEIGHTS.role}`);
  }
  if (fp.inputType && candidate.inputType && fp.inputType === candidate.inputType) {
    score += WEIGHTS.inputType; breakdown.push(`type:+${WEIGHTS.inputType}`);
  }
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

// --- Utilities ---

function buildHealingReport(fp: ElementFingerprint, best: ScoredCandidate): string {
  const changes: string[] = [];
  if (fp.cssPath !== best.cssPath) {
    changes.push(`cssPath: "${truncate(fp.cssPath, 50)}" -> "${truncate(best.cssPath, 50)}"`);
  }
  if (changes.length === 0) {
    changes.push('Element found at same location with matching attributes');
  }
  return [`Self-healed with ${best.score}pts`, `Signals: ${best.breakdown.join(', ')}`, ...changes].join('\n');
}

function normalizeText(text: string): string {
  return text.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
}

function cssEscape(value: string): string {
  return value.replace(/([^\w-])/g, '\\$1');
}

function truncate(str: string, max: number): string {
  return str.length > max ? str.substring(0, max) + '...' : str;
}
