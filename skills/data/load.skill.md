# Skill: data/load

## Input
- **filePath** (string, required): Relative to output/
- **format** ('json' | 'excel' | 'csv', required)
- **sheetName** (string, optional): For Excel

## Code Patterns
```typescript
import testData from '../test-data/web/scenario-name.json';
import { readCsvData } from '../../core/test-data-loader';
const users = readCsvData('test-data/datasets/users.csv');

// DATASETS parameterized loop
for (const data of testData) {
  test(`Test: ${data.description}`, async ({ page }) => { /* use data.field */ });
}
```
