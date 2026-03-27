# Skill: web/wait

## Input
- **strategy** ('selector' | 'url' | 'loadState' | 'networkIdle' | 'response' | 'function', required)
- **condition** (string, required): What to wait for
- **timeout** (number, default: 30000): Maximum wait time in ms

## Output
- **waited** (boolean), **durationMs** (number)

## Rules — MUST Follow
- **MUST NOT** use `page.waitForTimeout()` — EVER — unless accompanied by a `// PACING:` comment explaining why the delay is needed AND the app-context documents the component as slow
- **MUST** use proper Playwright waits: `waitForSelector`, `waitForURL`, `waitForLoadState`, `waitForResponse`, `waitForFunction`
- **MUST** choose the wait strategy that matches the actual application behavior observed during exploration

## Code Patterns
```typescript
// Wait for element
await page.waitForSelector('[data-testid="results"]', { state: 'visible' });

// Wait for URL
await page.waitForURL(/\/dashboard/, { timeout: 60000 });

// Wait for page load
await page.waitForLoadState('networkidle');

// Wait for API response
await page.waitForResponse(r => r.url().includes('/api/data') && r.status() === 200);

// Wait for custom condition (e.g., grid rows loaded)
await page.waitForFunction(() => document.querySelectorAll('table tbody tr').length > 0);
```

## Known Patterns
- **PCF grids:** Render empty DOM → inject text asynchronously → MUST use `waitForFunction()` polling for cell content. `networkidle` alone is NOT sufficient.
- **Microsoft SSO:** Redirect chain can take up to 60s for enterprise SSO → increase timeout
- **SPA navigation:** URL changes but content loads asynchronously → wait for BOTH `waitForURL` AND a content indicator
