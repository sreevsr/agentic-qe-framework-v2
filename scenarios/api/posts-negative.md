# Scenario: Posts Negative Tests

## Metadata
- **Module:** Posts API
- **Priority:** P1
- **Type:** api
- **Tags:** api, negative, regression, posts

## API Behavior: mock
<!-- JSONPlaceholder accepts most requests without validation and returns 201 for POST
     even with missing/empty fields. Negative tests document ACTUAL observed behavior
     rather than strict RFC validation — see notes per step. -->

## Application
- **API Base URL:** {{ENV.API_BASE_URL}}
- **Authentication:** None — public API

## Pre-conditions
- API accessible at {{ENV.API_BASE_URL}}

## Steps

### GET — Non-existent resource (id out of range)
1. API GET: {{ENV.API_BASE_URL}}/posts/99999
2. VERIFY: Response status is 404

### GET — Non-existent resource (id = 0)
3. API GET: {{ENV.API_BASE_URL}}/posts/0
4. VERIFY: Response status is 404

### GET — Non-existent resource (string id)
5. API GET: {{ENV.API_BASE_URL}}/posts/notanumber
6. VERIFY: Response status is 404

### POST — Missing required fields (empty body)
7. API POST: {{ENV.API_BASE_URL}}/posts with body {}
8. VERIFY: Response status is 201
9. VERIFY: Response body contains field "id" with value 101
<!-- NOTE: JSONPlaceholder does NOT validate required fields — it accepts empty body.
     This step documents actual API behavior (permissive mock). A production API
     implementing the spec correctly would return 400. -->

### POST — Missing required field: userId
10. API POST: {{ENV.API_BASE_URL}}/posts with body {"title": "No userId Post", "body": "Body text"}
11. VERIFY: Response status is 201
12. VERIFY: Response body contains field "id" with value 101
<!-- NOTE: Same permissive behavior — documents mock acceptance of incomplete data. -->

### DELETE — Non-existent resource
13. API DELETE: {{ENV.API_BASE_URL}}/posts/99999
14. VERIFY: Response status is 200
<!-- NOTE: JSONPlaceholder returns 200 (not 404) for DELETE on nonexistent resources.
     This tests the actual mock behavior. A strict API would return 404. -->

### PUT — Non-existent resource
15. API PUT: {{ENV.API_BASE_URL}}/posts/99999 with body {"title": "Ghost Put", "body": "Ghost body", "userId": 1}
16. VERIFY: Response status is 200
<!-- NOTE: JSONPlaceholder returns 200 for PUT on nonexistent IDs (simulated update). -->

### PATCH — Non-existent resource
17. API PATCH: {{ENV.API_BASE_URL}}/posts/99999 with body {"title": "Ghost Patch"}
18. VERIFY: Response status is 200
<!-- NOTE: Same mock behavior — returns 200 regardless of whether resource exists. -->

## Test Data
| Field        | Value      | Notes                                        |
|--------------|------------|----------------------------------------------|
| invalidIdLarge | 99999   | Post IDs only exist up to 100               |
| invalidIdZero  | 0       | Post IDs start at 1                         |
| invalidIdStr   | notanumber | Non-numeric path segment                  |
| emptyBody    | {}         | Missing all required fields                  |
| partialBody  | {"title": "No userId Post", "body": "Body text"} | Missing userId |

## Notes
- JSONPlaceholder is a permissive mock API — it does NOT enforce schema validation on POST bodies.
- Negative tests here document ACTUAL mock behavior, not ideal RFC-compliant behavior.
- Steps 7–12 are labelled as documentation tests: they verify the API's known permissive behavior.
- If this API is later replaced with a persistent backend, steps 7–12 expectations should change to 400.
- The spec declares POST body fields (title, body, userId) as required — a production server should enforce this.
