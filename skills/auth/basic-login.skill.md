# Skill: auth/basic-login

## Input
- **usernameSelector**, **passwordSelector**, **submitSelector** (string, required)
- **credentials**: `{ username, password }` from env vars

## Output
- **authenticated** (boolean), **storageStatePath** (string)

## Code Pattern
```typescript
async login(): Promise<void> {
  await this.page.locator(this.loc.get('usernameInput')).fill(process.env.TEST_USERNAME!);
  await this.page.locator(this.loc.get('passwordInput')).fill(process.env.TEST_PASSWORD!);
  await this.page.locator(this.loc.get('loginButton')).click();
  await this.page.waitForLoadState('networkidle');
}
```
