# Skill: data/load

## Input
- **filePath** (string, required): Relative path from output/
- **format** ('json' | 'csv', required): File format

## Output
- **data** (any): Parsed data
- **recordCount** (number): Number of records loaded

## Behavior

1. Determine file format from the scenario DATASETS or test data reference
2. Use the appropriate loader from `core/test-data-loader.ts`
3. For DATASETS: load ALL rows, generate parameterized `for...of` loop

**NOTE:** Excel (.xlsx) support is planned but NOT yet implemented. For now, convert Excel files to CSV or JSON before use.

## Code Patterns

```typescript
// JSON — direct import
import testData from '../test-data/web/scenario-name.json';

// CSV — via test-data-loader utility
import { readCsvData } from '../../core/test-data-loader';
const users = readCsvData('test-data/datasets/users.csv');

// JSON data file — via test-data-loader utility
import { readJsonData } from '../../core/test-data-loader';
const claims = readJsonData('test-data/datasets/claims.json');

// DATASETS parameterized loop — MUST explore first row only, generate loop for all
for (const data of testData) {
  test(`Test: ${data.description}`, async ({ page }) => {
    // use data.field1, data.field2, etc.
  });
}
```
