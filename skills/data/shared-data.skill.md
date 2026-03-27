# Skill: data/shared-data

## Input
- **datasetNames** (string[], required): Names of shared datasets (e.g., ['users', 'products'])

## Output
- **mergedData** (object): Merged data from shared files + scenario-specific overrides

## Rules — MUST Follow
- **MUST** use `loadTestData()` from `core/test-data-loader` — NEVER read shared files directly
- **MUST NOT** modify files in `output/test-data/shared/` — they are cross-scenario, immutable
- If a scenario needs different values, **MUST** create a scenario-specific override instead

## Code Pattern
```typescript
import { loadTestData } from '../../core/test-data-loader';
const testData = loadTestData('web/saucedemo-checkout', ['users', 'products']);
// testData = merged { ...shared/users, ...shared/products, ...web/saucedemo-checkout }
```

## Merge Order
1. Load each shared dataset in order specified
2. Load scenario-specific JSON last (overrides shared values)
3. Later datasets override earlier ones on key conflicts
