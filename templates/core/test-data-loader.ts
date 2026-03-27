import * as fs from 'fs';
import * as path from 'path';

/**
 * Test Data Loader — Loads and merges test data from JSON, CSV, and Excel files.
 *
 * Data priority (last wins):
 * 1. Shared datasets (output/test-data/shared/)
 * 2. Scenario-specific data (output/test-data/{type}/{scenario}.json)
 */

const TEST_DATA_ROOT = path.resolve(__dirname, '..', 'test-data');

/**
 * Load test data for a scenario, optionally merging shared datasets.
 *
 * @param scenarioPath - Relative path like 'web/saucedemo-checkout'
 * @param sharedDatasets - Array of shared dataset names ['users', 'products']
 * @returns Merged data object (shared first, then scenario-specific overrides)
 */
export function loadTestData(scenarioPath: string, sharedDatasets: string[] = []): Record<string, any> {
  let merged: Record<string, any> = {};

  for (const dataset of sharedDatasets) {
    const sharedPath = path.join(TEST_DATA_ROOT, 'shared', `${dataset}.json`);
    if (fs.existsSync(sharedPath)) {
      merged = { ...merged, ...parseJsonFile(sharedPath) };
    }
  }

  const scenarioDataPath = path.join(TEST_DATA_ROOT, `${scenarioPath}.json`);
  if (fs.existsSync(scenarioDataPath)) {
    merged = { ...merged, ...parseJsonFile(scenarioDataPath) };
  }

  return merged;
}

/**
 * Load a single shared dataset by name.
 */
export function loadSharedData(name: string): Record<string, any> {
  const filePath = path.join(TEST_DATA_ROOT, 'shared', `${name}.json`);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Shared data file not found: ${filePath}`);
  }
  return parseJsonFile(filePath);
}

/**
 * Read data from a JSON file.
 */
export function readJsonData(filePath: string): any {
  const fullPath = path.resolve(__dirname, '..', filePath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`JSON data file not found: ${fullPath}`);
  }
  return parseJsonFile(fullPath);
}

/**
 * Read data from a CSV file.
 * Handles quoted values containing commas (RFC 4180 basic support).
 *
 * @param filePath - Relative path from output/ (e.g., 'test-data/datasets/users.csv')
 * @returns Array of objects (header row becomes keys)
 */
export function readCsvData(filePath: string): Record<string, string>[] {
  const fullPath = path.resolve(__dirname, '..', filePath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`CSV data file not found: ${fullPath}`);
  }
  const content = fs.readFileSync(fullPath, 'utf-8');
  const lines = content.trim().split('\n').map(line => line.trim());
  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map(line => {
    const values = parseCsvLine(line);
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = values[i] || ''; });
    return obj;
  });
}

/**
 * Read data from an Excel (.xlsx) file.
 * Requires the 'xlsx' package to be installed.
 *
 * @param filePath - Relative path from output/ (e.g., 'test-data/datasets/claims.xlsx')
 * @param sheetName - Sheet name (defaults to first sheet)
 * @returns Array of objects (header row becomes keys)
 */
export function readExcelData(filePath: string, sheetName?: string): Record<string, any>[] {
  const fullPath = path.resolve(__dirname, '..', filePath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Excel data file not found: ${fullPath}`);
  }

  let XLSX: any;
  try {
    XLSX = require('xlsx');
  } catch {
    throw new Error(
      'Excel support requires the "xlsx" package. Install it: npm install xlsx\n' +
      'Or convert your Excel file to CSV/JSON before use.'
    );
  }

  const workbook = XLSX.readFile(fullPath);
  const sheet = sheetName
    ? workbook.Sheets[sheetName]
    : workbook.Sheets[workbook.SheetNames[0]];

  if (!sheet) {
    throw new Error(`Sheet "${sheetName || 'first'}" not found in ${filePath}`);
  }

  return XLSX.utils.sheet_to_json(sheet);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Parse a JSON file with a clear error message on failure.
 */
function parseJsonFile(filePath: string): any {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (err: any) {
    throw new Error(`Invalid JSON in ${filePath}: ${err.message}`);
  }
}

/**
 * Parse a single CSV line, handling quoted values that contain commas.
 * Basic RFC 4180 support: "value with, comma" is treated as one field.
 */
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'; // escaped quote
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      fields.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  fields.push(current.trim());
  return fields;
}
