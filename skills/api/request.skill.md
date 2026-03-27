# Skill: api/request

## Input
- **method** ('GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', required)
- **url** (string, required): Endpoint (relative to API_BASE_URL or absolute)
- **headers** (object, optional), **body** (object, optional)

## Output
- **status** (number), **responseBody** (any), **headers** (object)

## Rules
- Use Playwright `request` fixture — NEVER `fetch` or `axios`
- `api` type: `{ request }` | `hybrid` type: `{ page, request }`
- Always assert status code

## Code Patterns
```typescript
const response = await request.get(`${process.env.API_BASE_URL}/users`);
expect(response.status()).toBe(200);

const response = await request.post(`${process.env.API_BASE_URL}/users`, {
  data: { name: 'John' },
  headers: { Authorization: `Bearer ${process.env.API_TOKEN}` },
});
expect(response.status()).toBe(201);
```

## CRUD Guardrail
Unless `## API Behavior: mock`: POST→GET must find resource, PUT→GET must show update, DELETE→GET must 404.
