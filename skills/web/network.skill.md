# Skill: web/network

## Input
- **action** ('intercept' | 'mock' | 'abort' | 'waitForResponse', required)
- **urlPattern** (string, required): URL pattern to match
- **mockResponse** (object, optional): Response to return for mocked requests

## Output
- **intercepted** (boolean), **requestCount** (number)

## Rules — MUST Follow
- **MUST** set up route handlers BEFORE navigating to the page
- **MUST** clean up routes when done: `await page.unroute(pattern)`
- Use sparingly — only when the scenario explicitly requires network control

## Code Patterns
```typescript
// Mock API response
await page.route('**/api/users', route => {
  route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ users: [{ id: 1, name: 'Mock User' }] }),
  });
});

// Block analytics/tracking (speed up tests)
await page.route('**/{analytics,tracking,gtm}**', route => route.abort());

// Wait for specific API response
const response = await page.waitForResponse(
  resp => resp.url().includes('/api/data') && resp.status() === 200
);
const data = await response.json();

// Simulate slow network
await page.route('**/*', route => {
  setTimeout(() => route.continue(), 2000); // 2s delay
});
```

## Known Patterns
- **API mocking for isolated UI tests:** Mock backend responses to test UI behavior independently
- **Block third-party scripts:** Analytics, chat widgets, ads that slow tests
- **Simulate error responses:** Test error handling UI with mocked 500/503 responses
