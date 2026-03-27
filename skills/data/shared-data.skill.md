# Skill: data/shared-data

## Input
- **datasetNames** (string[], required): e.g., ['users', 'products']

## Code Pattern
```typescript
import { loadTestData } from '../../core/test-data-loader';
const testData = loadTestData('web/saucedemo-checkout', ['users', 'products']);
```

## Guardrail
Shared data (`output/test-data/shared/`) is IMMUTABLE. Create scenario-specific overrides instead.
