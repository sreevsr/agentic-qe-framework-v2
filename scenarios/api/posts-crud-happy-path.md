# Scenario: Posts CRUD Happy Path

## Metadata
- **Module:** Posts API
- **Priority:** P0
- **Type:** api
- **Tags:** api, crud, smoke, posts

## API Behavior: mock
<!-- JSONPlaceholder is a fake REST API — POST/PUT/PATCH/DELETE return correct status codes
     and response shapes but do NOT persist changes on the server.
     id=101 is always returned for POST. Persistence assertions are adapted accordingly. -->

## Application
- **API Base URL:** {{ENV.API_BASE_URL}}
- **Authentication:** None — public API

## Pre-conditions
- API accessible at {{ENV.API_BASE_URL}}

## Steps

### Create a new post
1. API POST: {{ENV.API_BASE_URL}}/posts with body {"title": "Test Post Title", "body": "Test post body content.", "userId": 1}
2. VERIFY: Response status is 201
3. VERIFY: Response body contains field "id" with value 101
4. VERIFY: Response body contains field "title" with value "Test Post Title"
5. VERIFY: Response body contains field "body" with value "Test post body content."
6. VERIFY: Response body contains field "userId" with value 1
7. CAPTURE: Response $.id as {{postId}}

### Read an existing post (using stable resource id=1, not the faked 101)
8. API GET: {{ENV.API_BASE_URL}}/posts/1
9. VERIFY: Response status is 200
10. VERIFY: Response body contains fields: id, userId, title, body
11. VERIFY: Response body field "id" equals 1
12. CAPTURE: Response $.userId as {{existingUserId}}

### Replace post entirely (PUT)
13. API PUT: {{ENV.API_BASE_URL}}/posts/1 with body {"title": "Replaced Title", "body": "Replaced body content.", "userId": 1}
14. VERIFY: Response status is 200
15. VERIFY: Response body contains field "title" with value "Replaced Title"
16. VERIFY: Response body contains field "body" with value "Replaced body content."
17. VERIFY: Response body contains field "userId" with value 1
18. VERIFY: Response body contains field "id" with value 1

### Partially update a post (PATCH)
19. API PATCH: {{ENV.API_BASE_URL}}/posts/1 with body {"title": "Patched Title Only"}
20. VERIFY: Response status is 200
21. VERIFY: Response body contains field "title" with value "Patched Title Only"
22. VERIFY: Response body contains field "id" with value 1

### Delete a post
23. API DELETE: {{ENV.API_BASE_URL}}/posts/1
24. VERIFY: Response status is 200
25. VERIFY: Response body is empty object {}

## Test Data
| Field      | Value                        | Notes                              |
|------------|------------------------------|------------------------------------|
| createTitle | Test Post Title              | Used in POST step 1                |
| createBody  | Test post body content.      | Used in POST step 1                |
| createUserId | 1                           | Valid userId range: 1–10           |
| postId      | 101                          | Always returned by JSONPlaceholder |
| stableId    | 1                            | Existing post — safe for GET/PUT/PATCH/DELETE |
| patchTitle  | Patched Title Only           | Used in PATCH step 19              |

## Notes
- API Behavior is `mock` — JSONPlaceholder fakes all mutating operations. id=101 is always returned by POST.
- PUT/PATCH/DELETE return correct-shaped responses but changes are not persisted.
- Steps 8–12 use post id=1 (a stable, real resource) to test GET independently of the fake POST.
- CRUD full cycle (create → read created → update → delete → verify 404) is not possible on a mock API.
- Consider testing with a live persistent API to validate true CRUD lifecycle.
