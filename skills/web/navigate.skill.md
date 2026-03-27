# Skill: web/navigate

## Input
- **url** (string, required): Target URL or `{{ENV.BASE_URL}}`
- **waitUntil** ('load' | 'domcontentloaded' | 'networkidle', default: 'networkidle')

## Output
- **finalUrl** (string): URL after all redirects settled
- **pageTitle** (string): Document title

## Rules — MUST Follow
- **MUST** resolve `{{ENV.*}}` from `process.env` before navigating
- **MUST** wait for URL to stabilize after navigation (SSO/SPA redirects)
- **MUST** record final URL — it may differ from the initial URL
- **MUST** use `networkidle` as default waitUntil for enterprise apps (safest)
- **MUST NOT** hardcode URLs — use `process.env.BASE_URL`

## Behavior
1. Navigate via `page.goto(url, { waitUntil })`
2. After navigation, check if URL changed (SPA redirects, SSO chains)
3. If URL still changing, wait up to 10s for stabilization
4. Record final URL after all redirects

## Code Pattern
```typescript
async navigate(): Promise<void> {
  await this.page.goto(process.env.BASE_URL!, { waitUntil: 'networkidle' });
  // Wait for final URL if redirect chain expected
  // await this.page.waitForURL(/\/expected-path/);
}
```

## Known Patterns
- **Microsoft SSO:** Lands at `/Experts/` then redirects to `/SMEInsights/` — use `waitForURL()` for FINAL destination
- **Power Apps portals:** Multiple client-side redirects, loading spinners after navigation
- **SPA apps (React/Angular):** URL changes via client-side routing — `networkidle` is the safest wait
