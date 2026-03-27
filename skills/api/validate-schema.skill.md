# Skill: api/validate-schema

## Input
- **response** (APIResponse, required)
- **schema** (object, optional): Expected fields and types

## Output
- **valid** (boolean), **errors** (string[])

## Code Patterns
```typescript
const body = await response.json();
expect(body).toHaveProperty('id');
expect(typeof body.id).toBe('number');
expect(Array.isArray(body.data)).toBe(true);
expect(body.data.length).toBeGreaterThan(0);
```
