"""
Test Data Loader — Loads and merges test data from JSON, CSV, and Excel files (Python).
"""

import json
import csv
import os
from pathlib import Path

TEST_DATA_ROOT = Path(__file__).parent.parent / "test-data"


def load_test_data(scenario_path: str, shared_datasets: list[str] | None = None) -> dict:
    """Load test data, merging shared datasets with scenario-specific data."""
    merged = {}

    for dataset in (shared_datasets or []):
        shared_path = TEST_DATA_ROOT / "shared" / f"{dataset}.json"
        if shared_path.exists():
            merged.update(_parse_json(shared_path))

    scenario_data_path = TEST_DATA_ROOT / f"{scenario_path}.json"
    if scenario_data_path.exists():
        merged.update(_parse_json(scenario_data_path))

    return merged


def load_shared_data(name: str) -> dict:
    """Load a single shared dataset."""
    file_path = TEST_DATA_ROOT / "shared" / f"{name}.json"
    if not file_path.exists():
        raise FileNotFoundError(f"Shared data file not found: {file_path}")
    return _parse_json(file_path)


def read_json_data(file_path: str) -> dict | list:
    """Read data from a JSON file."""
    full_path = Path(__file__).parent.parent / file_path
    if not full_path.exists():
        raise FileNotFoundError(f"JSON data file not found: {full_path}")
    return _parse_json(full_path)


def read_csv_data(file_path: str) -> list[dict[str, str]]:
    """Read data from a CSV file. Returns list of dicts (header row becomes keys)."""
    full_path = Path(__file__).parent.parent / file_path
    if not full_path.exists():
        raise FileNotFoundError(f"CSV data file not found: {full_path}")
    with open(full_path, "r", newline="") as f:
        reader = csv.DictReader(f)
        return [dict(row) for row in reader]


def read_excel_data(file_path: str, sheet_name: str | None = None) -> list[dict]:
    """Read data from an Excel file. Requires openpyxl package."""
    full_path = Path(__file__).parent.parent / file_path
    if not full_path.exists():
        raise FileNotFoundError(f"Excel data file not found: {full_path}")
    try:
        import openpyxl
    except ImportError:
        raise ImportError(
            'Excel support requires openpyxl. Install it: pip install openpyxl\n'
            'Or convert your Excel file to CSV/JSON before use.'
        )
    wb = openpyxl.load_workbook(full_path, read_only=True)
    ws = wb[sheet_name] if sheet_name else wb.active
    rows = list(ws.iter_rows(values_only=True))
    if len(rows) < 2:
        return []
    headers = [str(h) for h in rows[0]]
    return [{headers[i]: cell for i, cell in enumerate(row)} for row in rows[1:]]


def _parse_json(file_path: Path) -> dict | list:
    """Parse JSON with clear error on failure."""
    try:
        with open(file_path, "r") as f:
            return json.load(f)
    except json.JSONDecodeError as e:
        raise ValueError(f"Invalid JSON in {file_path}: {e}")
