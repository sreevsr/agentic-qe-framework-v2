# Skill: web/wait

## Input
- **strategy** ('selector' | 'url' | 'loadState' | 'networkIdle' | 'response' | 'function', required)
- **condition** (string, required)
- **timeout** (number, default: 30000)

## Output
- **waited** (boolean), **durationMs** (number)

## HARD RULE
NEVER use `page.waitForTimeout()`. Exception: `// PACING:` comment with app-context justification.

## Code Patterns
```typescript
await page.waitForSelector('[data-testid="results"]', { state: 'visible' });
await page.waitForURL(/\/dashboard/, { timeout: 60000 });
await page.waitForLoadState('networkidle');
await page.waitForResponse(r => r.url().includes('/api/data') && r.status() === 200);
await page.waitForFunction(() => document.querySelectorAll('table tbody tr').length > 0);
```

## Known Patterns
- **PCF grids:** empty DOM → async inject → need `waitForFunction()` for cell content
- **Microsoft SSO:** up to 60s for enterprise SSO redirect chains
