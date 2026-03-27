# Skill: auth/storage-state

## Input
- **action** ('save' | 'restore', required)
- **path** (string, default: 'output/auth/storage-state.json')

## Save
```typescript
await page.context().storageState({ path: 'output/auth/storage-state.json' });
```

## Restore (playwright.config.ts or test setup)
```typescript
use: { storageState: 'output/auth/storage-state.json' }
```

## Subagent Handoff
Parent saves state after auth → each subagent restores → no login replay.
