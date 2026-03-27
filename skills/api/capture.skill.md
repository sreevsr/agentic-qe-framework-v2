# Skill: api/capture

## Input
- **response** (APIResponse, required)
- **jsonPath** (string, required): e.g., `$.id`, `$.data[0].name`
- **variableName** (string, required)

## Output
- **capturedValue** (any)

## Code Patterns
```typescript
const body = await response.json();
const userId = body.id;
const firstName = body.data[0].name;
const resourceUrl = response.headers()['location'];
```
