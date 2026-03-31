/**
 * test-fingerprint.ts — POC test for page-scanner + fingerprint-resolver.
 *
 * Tests the full cycle:
 *   1. Scan a page → get fingerprinted element list
 *   2. Simulate "plan generation" by picking elements
 *   3. Navigate away and back (or mutate DOM)
 *   4. Re-resolve each element using only the stored fingerprint
 *   5. Report: which elements resolved, at what tier, confidence, healed?
 *
 * Usage:
 *   npx tsx scripts/test-fingerprint.ts --app=automationexercise [--headed]
 *   npx tsx scripts/test-fingerprint.ts --app=orangehrm [--headed]
 *   npx tsx scripts/test-fingerprint.ts --app=enterprise --url=<url> [--headed]
 */

import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { scanPage, formatScanForLLM, ScanResult, ScannedElement } from './replay/page-scanner';
import { resolveByFingerprint, FingerprintMatch } from './replay/fingerprint-resolver';
import { ElementFingerprint } from './replay/page-scanner';

// --- App Configurations ---

interface AppConfig {
  name: string;
  url: string;
  /** Pages to test: navigate to URL, scan, pick elements, resolve. */
  pages: PageTest[];
}

interface PageTest {
  label: string;
  url: string;
  /** Optional: steps to perform before scanning (e.g., login). */
  setup?: (page: Page) => Promise<void>;
  /** Number of elements to test from the scan (default: all, capped at 30). */
  maxElements?: number;
}

const APP_CONFIGS: Record<string, AppConfig> = {
  automationexercise: {
    name: 'AutomationExercise',
    url: 'https://automationexercise.com',
    pages: [
      {
        label: 'Home Page',
        url: 'https://automationexercise.com',
        maxElements: 30,
      },
      {
        label: 'Products Page',
        url: 'https://automationexercise.com/products',
        maxElements: 30,
      },
      {
        label: 'Login Page',
        url: 'https://automationexercise.com/login',
        maxElements: 30,
      },
    ],
  },
  orangehrm: {
    name: 'OrangeHRM Demo',
    url: 'https://opensource-demo.orangehrmlive.com',
    pages: [
      {
        label: 'Login Page',
        url: 'https://opensource-demo.orangehrmlive.com/web/index.php/auth/login',
        maxElements: 30,
      },
      {
        label: 'Dashboard (after login)',
        url: 'https://opensource-demo.orangehrmlive.com/web/index.php/dashboard/index',
        setup: async (page: Page) => {
          await page.goto('https://opensource-demo.orangehrmlive.com/web/index.php/auth/login', { timeout: 60000 });
          await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
          await page.locator('input[name="username"]').fill('Admin', { timeout: 15000 });
          await page.locator('input[name="password"]').fill('admin123');
          await page.locator('button[type="submit"]').click();
          await page.waitForURL('**/dashboard/**', { timeout: 30000 });
          await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
        },
        maxElements: 30,
      },
    ],
  },
};

// --- CLI Parsing ---

interface CliArgs {
  app: string;
  headed: boolean;
  url?: string;
}

function parseArgs(): CliArgs {
  const args: Record<string, string | boolean> = {};
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith('--')) {
      const [key, ...rest] = arg.slice(2).split('=');
      args[key] = rest.length > 0 ? rest.join('=') : true;
    }
  }
  return {
    app: (args.app as string) || 'automationexercise',
    headed: !!args.headed,
    url: args.url as string | undefined,
  };
}

// --- Test Engine ---

interface ElementTestResult {
  idx: number;
  label: string;
  tier: number | null;
  confidence: number;
  healed: boolean;
  strategy: string;
  error?: string;
}

interface PageTestResult {
  pageLabel: string;
  url: string;
  scanDurationMs: number;
  totalElements: number;
  testedElements: number;
  results: ElementTestResult[];
  tier1Count: number;
  tier2Count: number;
  failCount: number;
  resolveDurationMs: number;
}

async function testPage(
  page: Page,
  pageTest: PageTest,
): Promise<PageTestResult> {
  // Setup (login, etc.)
  if (pageTest.setup) {
    console.log(`    Setting up (login, etc.)...`);
    await pageTest.setup(page);
  } else {
    await page.goto(pageTest.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
  }

  // Dismiss cookie banners
  await dismissCommonPopups(page);

  // Phase 1: Scan the page
  console.log(`    Scanning...`);
  const scan = await scanPage(page);
  console.log(`    Found ${scan.elements.length} interactive elements in ${scan.scanDurationMs}ms`);

  // Pick elements to test
  const maxEl = pageTest.maxElements || 30;
  const toTest = scan.elements.slice(0, maxEl);

  // Store fingerprints (simulate what the plan would store)
  const storedFingerprints: Array<{ idx: number; label: string; fingerprint: ElementFingerprint }> =
    toTest.map((el) => ({
      idx: el.idx,
      label: el.label,
      fingerprint: { ...el.fingerprint },
    }));

  // Phase 2: Navigate away and back (proves resolution works across page loads)
  // Skip re-navigation for pages with setup (login etc.) — server may be slow
  if (!pageTest.setup) {
    console.log(`    Navigating away and back to test resolution...`);
    await page.goto('about:blank');
    await page.waitForTimeout(500);
    await page.goto(pageTest.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    await dismissCommonPopups(page);
  } else {
    console.log(`    Resolving on same page load (skip re-nav for auth pages)...`);
  }

  // Phase 3: Resolve each stored fingerprint
  console.log(`    Resolving ${storedFingerprints.length} elements via fingerprint...`);
  const resolveStart = Date.now();
  const results: ElementTestResult[] = [];

  for (const stored of storedFingerprints) {
    try {
      const match = await resolveByFingerprint(page, stored.fingerprint, 3000);
      if (match) {
        results.push({
          idx: stored.idx,
          label: stored.label,
          tier: match.tier,
          confidence: match.confidence,
          healed: match.healed,
          strategy: match.strategy,
        });
      } else {
        results.push({
          idx: stored.idx,
          label: stored.label,
          tier: null,
          confidence: 0,
          healed: false,
          strategy: 'FAILED',
          error: 'No match found',
        });
      }
    } catch (err: any) {
      results.push({
        idx: stored.idx,
        label: stored.label,
        tier: null,
        confidence: 0,
        healed: false,
        strategy: 'ERROR',
        error: err.message,
      });
    }
  }

  const resolveDuration = Date.now() - resolveStart;

  return {
    pageLabel: pageTest.label,
    url: pageTest.url,
    scanDurationMs: scan.scanDurationMs,
    totalElements: scan.elements.length,
    testedElements: storedFingerprints.length,
    results,
    tier1Count: results.filter((r) => r.tier === 1).length,
    tier2Count: results.filter((r) => r.tier === 2).length,
    failCount: results.filter((r) => r.tier === null).length,
    resolveDurationMs: resolveDuration,
  };
}

async function dismissCommonPopups(page: Page): Promise<void> {
  // Try common cookie/consent selectors
  const dismissSelectors = [
    'button:has-text("Accept")',
    'button:has-text("Got it")',
    'button:has-text("I agree")',
    'button:has-text("Consent")',
    '.cc-dismiss',
    '#cookie-accept',
    '[aria-label="Close"]',
    '.fc-cta-consent',
  ];
  for (const sel of dismissSelectors) {
    try {
      const btn = page.locator(sel).first();
      if (await btn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await btn.click({ timeout: 1000 }).catch(() => {});
        await page.waitForTimeout(300);
      }
    } catch {
      // Ignore
    }
  }
}

// --- Report ---

function printReport(appName: string, pageResults: PageTestResult[]): void {
  console.log('\n' + '='.repeat(80));
  console.log(`FINGERPRINT RESOLUTION TEST REPORT — ${appName}`);
  console.log('='.repeat(80));

  let totalTested = 0;
  let totalTier1 = 0;
  let totalTier2 = 0;
  let totalFailed = 0;
  let totalScanMs = 0;
  let totalResolveMs = 0;

  for (const pr of pageResults) {
    console.log(`\n--- ${pr.pageLabel} (${pr.url}) ---`);
    console.log(`  Scan: ${pr.totalElements} elements in ${pr.scanDurationMs}ms`);
    console.log(`  Tested: ${pr.testedElements} elements`);
    console.log(`  Resolve: ${pr.resolveDurationMs}ms total (${Math.round(pr.resolveDurationMs / pr.testedElements)}ms/element avg)`);
    console.log(`  Results: Tier1=${pr.tier1Count} | Tier2=${pr.tier2Count} | Failed=${pr.failCount}`);

    const passRate = ((pr.tier1Count + pr.tier2Count) / pr.testedElements * 100).toFixed(1);
    console.log(`  Pass rate: ${passRate}%`);

    // Show failures
    const failures = pr.results.filter((r) => r.tier === null);
    if (failures.length > 0) {
      console.log(`\n  FAILURES:`);
      for (const f of failures) {
        console.log(`    [${f.idx}] ${f.label}`);
        console.log(`         Error: ${f.error}`);
      }
    }

    // Show self-healed elements (interesting — they moved but were found)
    const healed = pr.results.filter((r) => r.healed);
    if (healed.length > 0) {
      console.log(`\n  SELF-HEALED (${healed.length}):`);
      for (const h of healed) {
        console.log(`    [${h.idx}] ${h.label}`);
        console.log(`         ${h.strategy} (confidence: ${h.confidence}%)`);
      }
    }

    totalTested += pr.testedElements;
    totalTier1 += pr.tier1Count;
    totalTier2 += pr.tier2Count;
    totalFailed += pr.failCount;
    totalScanMs += pr.scanDurationMs;
    totalResolveMs += pr.resolveDurationMs;
  }

  console.log('\n' + '='.repeat(80));
  console.log('SUMMARY');
  console.log('='.repeat(80));
  console.log(`  App: ${appName}`);
  console.log(`  Pages tested: ${pageResults.length}`);
  console.log(`  Elements tested: ${totalTested}`);
  console.log(`  Tier 1 (direct match): ${totalTier1} (${(totalTier1 / totalTested * 100).toFixed(1)}%)`);
  console.log(`  Tier 2 (self-healed):  ${totalTier2} (${(totalTier2 / totalTested * 100).toFixed(1)}%)`);
  console.log(`  Failed:                ${totalFailed} (${(totalFailed / totalTested * 100).toFixed(1)}%)`);
  console.log(`  Overall pass rate:     ${((totalTier1 + totalTier2) / totalTested * 100).toFixed(1)}%`);
  console.log(`  Total scan time:       ${totalScanMs}ms`);
  console.log(`  Total resolve time:    ${totalResolveMs}ms (${Math.round(totalResolveMs / totalTested)}ms/element avg)`);
  console.log('='.repeat(80));
}

// --- Main ---

async function main(): Promise<void> {
  const args = parseArgs();

  // Get app config
  let appConfig = APP_CONFIGS[args.app];
  if (!appConfig && args.url) {
    // Custom URL for enterprise app testing
    appConfig = {
      name: `Enterprise (${args.app})`,
      url: args.url,
      pages: [
        {
          label: 'Main Page',
          url: args.url,
          maxElements: 30,
        },
      ],
    };
  }

  if (!appConfig) {
    console.error(`Unknown app: ${args.app}. Available: ${Object.keys(APP_CONFIGS).join(', ')}`);
    console.error(`Or use: --app=enterprise --url=<url>`);
    process.exit(1);
  }

  console.log(`\nFingerprint Resolution Test — ${appConfig.name}`);
  console.log(`Headed: ${args.headed}\n`);

  // Launch browser
  const browser: Browser = await chromium.launch({
    headless: !args.headed,
    args: args.headed ? ['--start-maximized'] : [],
  });

  const context: BrowserContext = await browser.newContext({
    viewport: args.headed ? null : { width: 1280, height: 720 },
    permissions: ['clipboard-read', 'clipboard-write'],
  });

  const page: Page = await context.newPage();

  // Run tests for each page
  const pageResults: PageTestResult[] = [];
  for (const pageTest of appConfig.pages) {
    console.log(`\n  Testing: ${pageTest.label}...`);
    try {
      const result = await testPage(page, pageTest);
      pageResults.push(result);
    } catch (err: any) {
      console.error(`  ERROR testing ${pageTest.label}: ${err.message}`);
      pageResults.push({
        pageLabel: pageTest.label,
        url: pageTest.url,
        scanDurationMs: 0,
        totalElements: 0,
        testedElements: 0,
        results: [],
        tier1Count: 0,
        tier2Count: 0,
        failCount: 0,
        resolveDurationMs: 0,
      });
    }
  }

  // Print report
  printReport(appConfig.name, pageResults);

  // Cleanup
  await browser.close();
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
