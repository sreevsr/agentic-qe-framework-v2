# Skill: api/validate-schema

## Input
- **response** (APIResponse, required): Playwright API response object
- **schema** (object, optional): Expected field names and types

## Output
- **valid** (boolean), **errors** (string[])

## Rules — MUST Follow
- **MUST** parse response body before validation
- **MUST** check both field existence AND field types
- **MUST** report specific missing/mistyped fields — NOT just "validation failed"

## Code Patterns
```typescript
// Validate response has expected fields
const body = await response.json();
expect(body).toHaveProperty('id');
expect(body).toHaveProperty('name');
expect(typeof body.id).toBe('number');
expect(typeof body.name).toBe('string');

// Validate array response
const body = await response.json();
expect(Array.isArray(body.data)).toBe(true);
expect(body.data.length).toBeGreaterThan(0);
expect(body.data[0]).toHaveProperty('id');
expect(body.data[0]).toHaveProperty('email');
```
