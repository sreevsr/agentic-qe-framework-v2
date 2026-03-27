# Skill: auth/storage-state

## Input
- **action** ('save' | 'restore', required)
- **path** (string, default: 'output/auth/storage-state.json')

## Output
- **statePath** (string), **restored** (boolean)

## Rules — MUST Follow
- **MUST** save storageState after successful authentication — this enables session reuse
- **MUST NOT** commit storageState files to git — they contain auth tokens (already in .gitignore)
- **MUST** use storageState for subagent handoff — each subagent restores instead of replaying login

## Code Patterns
```typescript
// Save (after successful login)
await page.context().storageState({ path: 'output/auth/storage-state.json' });

// Restore (in playwright.config.ts or test setup)
use: { storageState: 'output/auth/storage-state.json' }

// Restore in test.beforeAll for shared auth
test.beforeAll(async ({ browser }) => {
  const context = await browser.newContext({ storageState: 'output/auth/storage-state.json' });
  const page = await context.newPage();
  // ... already authenticated
  await page.close();
  await context.close();
});
```

## Subagent Handoff
Parent saves state after auth → each subagent restores → NO login replay needed.
