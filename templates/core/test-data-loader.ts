import * as fs from 'fs';
import * as path from 'path';

/**
 * Test Data Loader — Loads and merges test data from JSON, Excel, and CSV files.
 */

const TEST_DATA_ROOT = path.resolve(__dirname, '..', 'test-data');

export function loadTestData(scenarioPath: string, sharedDatasets: string[] = []): Record<string, any> {
  let merged: Record<string, any> = {};

  for (const dataset of sharedDatasets) {
    const sharedPath = path.join(TEST_DATA_ROOT, 'shared', `${dataset}.json`);
    if (fs.existsSync(sharedPath)) {
      merged = { ...merged, ...JSON.parse(fs.readFileSync(sharedPath, 'utf-8')) };
    }
  }

  const scenarioDataPath = path.join(TEST_DATA_ROOT, `${scenarioPath}.json`);
  if (fs.existsSync(scenarioDataPath)) {
    merged = { ...merged, ...JSON.parse(fs.readFileSync(scenarioDataPath, 'utf-8')) };
  }

  return merged;
}

export function loadSharedData(name: string): Record<string, any> {
  const filePath = path.join(TEST_DATA_ROOT, 'shared', `${name}.json`);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Shared data file not found: ${filePath}`);
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

export function readJsonData(filePath: string): any {
  const fullPath = path.resolve(__dirname, '..', filePath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`JSON data file not found: ${fullPath}`);
  }
  return JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
}

export function readCsvData(filePath: string): Record<string, string>[] {
  const fullPath = path.resolve(__dirname, '..', filePath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`CSV data file not found: ${fullPath}`);
  }
  const content = fs.readFileSync(fullPath, 'utf-8');
  const lines = content.trim().split('\n').map(line => line.trim());
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim());
  return lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim());
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = values[i] || ''; });
    return obj;
  });
}
