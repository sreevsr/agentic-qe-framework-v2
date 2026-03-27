# Skill: api/capture

## Input
- **response** (APIResponse, required): Playwright API response object
- **jsonPath** (string, required): Path to extract (e.g., `$.id`, `$.data[0].name`)
- **variableName** (string, required): Variable name to store captured value

## Output
- **capturedValue** (any): The extracted value

## Rules — MUST Follow
- **MUST** parse response as JSON before extracting
- **MUST** declare captured variables with `let` in outer test scope
- **MUST** handle null/undefined — if path doesn't exist, log a warning, don't crash

## Code Patterns
```typescript
// CAPTURE: Response $.id as {{userId}}
const body = await response.json();
const userId = body.id;

// CAPTURE: Response $.data[0].name as {{firstName}}
const data = await response.json();
const firstName = data.data[0].name;

// CAPTURE: Response header Location as {{resourceUrl}}
const resourceUrl = response.headers()['location'];
```
