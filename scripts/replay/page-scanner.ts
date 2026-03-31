/**
 * page-scanner.ts — Scans the visible DOM and produces multi-signal fingerprints
 * for every interactive element.
 *
 * The browser-side scan logic lives in browser-scan.js (plain JS, never compiled
 * by tsx/esbuild). This file reads it at runtime via fs.readFileSync and passes
 * it to page.evaluate() as a string. This guarantees no __name helper injection
 * on any platform (Windows, Linux, macOS).
 */

import { Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

// --- Types ---

export interface ElementFingerprint {
  id?: string;
  testId?: string;
  text?: string;
  ariaLabel?: string;
  placeholder?: string;
  name?: string;
  title?: string;
  href?: string;
  tag: string;
  role?: string;
  inputType?: string;
  cssPath: string;
  nearestIdAncestor?: string;
  parentTag?: string;
  parentText?: string;
  siblingIndex: number;
  rect: { x: number; y: number; w: number; h: number };
  visible: boolean;
}

export interface ScannedElement {
  idx: number;
  fingerprint: ElementFingerprint;
  label: string;
}

export interface ScanResult {
  url: string;
  title: string;
  viewport: { width: number; height: number };
  elements: ScannedElement[];
  scanDurationMs: number;
}

// --- Load browser script once at module init ---

const BROWSER_SCAN_SCRIPT = fs.readFileSync(
  path.join(__dirname, 'browser-scan.js'),
  'utf-8',
);

// --- Scanner ---

export async function scanPage(page: Page): Promise<ScanResult> {
  const start = Date.now();

  const scanResult: any = await page.evaluate(BROWSER_SCAN_SCRIPT);

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
