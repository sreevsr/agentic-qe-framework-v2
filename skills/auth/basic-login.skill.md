# Skill: auth/basic-login

## Input
- **usernameSelector** (string, required): Locator name for username input
- **passwordSelector** (string, required): Locator name for password input
- **submitSelector** (string, required): Locator name for login button
- **credentials**: `{ username, password }` from `process.env`

## Output
- **authenticated** (boolean), **storageStatePath** (string)

## Rules — MUST Follow
- **MUST** use `process.env.TEST_USERNAME` and `process.env.TEST_PASSWORD` — NEVER hardcode credentials
- **MUST** wait for navigation/load state after clicking submit
- **MUST** verify login succeeded (check URL change, welcome message, or dashboard element)
- **MUST** save storageState after successful login if other tests need authenticated state

## Code Pattern
```typescript
async login(): Promise<void> {
  await this.page.locator(this.loc.get('usernameInput')).fill(process.env.TEST_USERNAME!);
  await this.page.locator(this.loc.get('passwordInput')).fill(process.env.TEST_PASSWORD!);
  await this.page.locator(this.loc.get('loginButton')).click();
  await this.page.waitForLoadState('networkidle');
}
```
