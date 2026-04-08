# Scenario: Posts List and Filter

## Metadata
- **Module:** Posts API
- **Priority:** P1
- **Type:** api
- **Tags:** api, list, filter, regression, posts

## API Behavior: mock

## Application
- **API Base URL:** {{ENV.API_BASE_URL}}
- **Authentication:** None — public API

## Pre-conditions
- API accessible at {{ENV.API_BASE_URL}}

## Steps

### List all posts (no filter)
1. API GET: {{ENV.API_BASE_URL}}/posts
2. VERIFY: Response status is 200
3. VERIFY: Response body is an array
4. VERIFY: Response array length equals 100
5. VERIFY: Each item in the array contains fields: id, userId, title, body
6. VERIFY: First item (index 0) contains field "id" with value 1
7. VERIFY: Last item (index 99) contains field "id" with value 100

### Filter posts by userId=1
8. API GET: {{ENV.API_BASE_URL}}/posts?userId=1
9. VERIFY: Response status is 200
10. VERIFY: Response body is an array
11. VERIFY: Response array length is greater than 0
12. VERIFY: Every item in the response array has field "userId" equal to 1
13. VERIFY: No item in the response array has field "userId" not equal to 1
14. CAPTURE: Response array length as {{userPostCount}}

### Filter posts by userId=10 (boundary — last valid userId)
15. API GET: {{ENV.API_BASE_URL}}/posts?userId=10
16. VERIFY: Response status is 200
17. VERIFY: Response body is an array
18. VERIFY: Every item in the response array has field "userId" equal to 10

### Filter posts by userId with no results (userId=99)
19. API GET: {{ENV.API_BASE_URL}}/posts?userId=99
20. VERIFY: Response status is 200
21. VERIFY: Response body is an empty array []

### Verify post structure — spot check known post
22. API GET: {{ENV.API_BASE_URL}}/posts/1
23. VERIFY: Response status is 200
24. VERIFY: Response body field "id" equals 1
25. VERIFY: Response body field "userId" is an integer between 1 and 10
26. VERIFY: Response body field "title" is a non-empty string
27. VERIFY: Response body field "body" is a non-empty string

## Test Data
| Field          | Value | Notes                             |
|----------------|-------|-----------------------------------|
| totalPostCount | 100   | JSONPlaceholder always has 100 posts |
| filterUserId1  | 1     | Valid userId — has posts          |
| filterUserId10 | 10    | Boundary — last valid userId      |
| filterUserIdNone | 99  | userId with no posts              |
| spotCheckId    | 1     | Known stable post for structure verification |

## Notes
- JSONPlaceholder has exactly 100 posts (ids 1–100), 10 users (userIds 1–10).
- The `userId` query parameter is the only supported filter — no pagination or sorting parameters.
- Response is not paginated — always returns the full filtered set.
- The spec documents `userId` filter range as 1–10.
