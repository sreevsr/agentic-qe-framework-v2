# Skill: web/navigate

## Input
- **url** (string, required): Target URL or `{{ENV.BASE_URL}}`
- **waitUntil** ('load' | 'domcontentloaded' | 'networkidle', default: 'networkidle')

## Output
- **finalUrl** (string): URL after redirects
- **pageTitle** (string): Document title

## Behavior
1. Navigate via `page.goto(url, { waitUntil })`
2. Resolve `{{ENV.*}}` from `process.env`
3. Wait for URL to stabilize (SSO/SPA redirects)
4. Record final URL

## Known Patterns
- **Microsoft SSO:** lands at `/Experts/` then redirects to `/SMEInsights/` — use `waitForURL()` with final pattern
- **Power Apps:** multiple client-side redirects; `networkidle` is safest

## Code Pattern
```typescript
async navigate(): Promise<void> {
  await this.page.goto(process.env.BASE_URL!, { waitUntil: 'networkidle' });
}
```
