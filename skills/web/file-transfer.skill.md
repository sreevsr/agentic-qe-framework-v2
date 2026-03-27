# Skill: web/file-transfer

## Input
- **action** ('upload' | 'download', required)
- **filePath** (string, required): For upload: path to file. For download: expected filename or save path.
- **selector** (string, optional): File input element (for upload)

## Output
- **success** (boolean), **filePath** (string): Actual path of uploaded/downloaded file

## Rules — MUST Follow
- **MUST** use `page.setInputFiles()` for upload — NEVER simulate drag-drop for file inputs
- **MUST** use `page.on('download')` handler for downloads — set up BEFORE triggering download
- **MUST NOT** hardcode file paths — use paths relative to test-data/datasets/
- For file chooser dialogs: use `page.on('filechooser')` — MUST register BEFORE clicking upload button

## Code Patterns

### File Upload
```typescript
// Standard file input
await page.setInputFiles(loc.get('fileInput'), 'test-data/datasets/document.pdf');

// File chooser dialog (no visible input element)
const [fileChooser] = await Promise.all([
  page.waitForEvent('filechooser'),
  page.locator(loc.get('uploadButton')).click(),
]);
await fileChooser.setFiles('test-data/datasets/report.xlsx');

// Multiple files
await page.setInputFiles(loc.get('fileInput'), [
  'test-data/datasets/doc1.pdf',
  'test-data/datasets/doc2.pdf',
]);
```

### File Download
```typescript
// Wait for download, then verify
const [download] = await Promise.all([
  page.waitForEvent('download'),
  page.locator(loc.get('exportButton')).click(),
]);
const filePath = await download.path();
const fileName = download.suggestedFilename();
expect(fileName).toContain('.csv');
```

## Known Patterns
- **Enterprise file uploads:** May have size limits, type restrictions — verify success message after upload
- **Slow uploads:** Large files need extended timeout on the waitForEvent
