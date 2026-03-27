# Scenario: [API Scenario Name]

## Metadata
- **Module:** [API Module Name]
- **Priority:** [P0 | P1 | P2]
- **Type:** api
- **Tags:** [api, smoke, regression, etc.]

## API Behavior: live
<!-- Change to 'mock' if the API is non-persistent (e.g., JSONPlaceholder) -->
<!-- 'live' = CRUD persistence guardrails enforced (POST→GET must find resource) -->
<!-- 'mock' = API is non-persistent, agents may adapt for non-persistence -->

## Application
- **API Base URL:** {{ENV.API_BASE_URL}}
- **Authentication:** Bearer {{ENV.API_TOKEN}}

## Pre-conditions
- API accessible at {{ENV.API_BASE_URL}}
- API token valid

## Steps
1. API GET: {{ENV.API_BASE_URL}}/endpoint
2. VERIFY: Response status is 200
3. VERIFY: Response body contains expected fields

4. API POST: {{ENV.API_BASE_URL}}/endpoint with body {"field": "value"}
5. VERIFY: Response status is 201
6. CAPTURE: Response $.id as {{resourceId}}

7. API GET: {{ENV.API_BASE_URL}}/endpoint/{{resourceId}}
8. VERIFY: Resource exists with correct values

9. API PUT: {{ENV.API_BASE_URL}}/endpoint/{{resourceId}} with body {"field": "updated"}
10. VERIFY: Response status is 200

11. API DELETE: {{ENV.API_BASE_URL}}/endpoint/{{resourceId}}
12. VERIFY: Response status is 200

## Test Data
| Field | Value | Notes |
|-------|-------|-------|
| apiToken | {{ENV.API_TOKEN}} | From environment |

## Notes for Explorer-Builder
- API tests use Playwright's request fixture — NO browser needed
- CAPTURE stores runtime values (IDs, tokens) for use in subsequent steps
- If API Behavior is 'mock', persistence assertions may be adapted
- For Swagger/OpenAPI specs, run: node scripts/swagger-parser.js --spec=<path>
