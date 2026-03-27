# Skill: auth/sso-login

## Input
- **provider** ('microsoft' | 'google' | 'okta', required)
- **email** (string): from `{{ENV.SSO_EMAIL}}`
- **password** (string): from `{{ENV.SSO_PASSWORD}}`

## Output
- **authenticated** (boolean), **storageStatePath** (string)

## Microsoft SSO Flow
1. Navigate to app → redirects to `login.microsoftonline.com`
2. Fill `input[name="loginfmt"]` with email
3. Click Next (`input[value="Next"]`)
4. Fill `input[name="passwd"]` with password
5. Click Sign in (`input[value="Sign in"]`)
6. Handle "Stay signed in?" prompt if present
7. Wait for redirect back to app
8. Wait for final URL to stabilize
9. Save storageState: `await page.context().storageState({ path: 'output/auth/storage-state.json' })`

## Known Patterns
- Final URL may differ from initial (e.g., `/Experts/` → `/SMEInsights/`)
- "Stay signed in?" → check `#KmsNextButton`, click if visible

## SECURITY
NEVER hardcode credentials. Storage state files MUST be gitignored.
