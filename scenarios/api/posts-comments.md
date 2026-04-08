# Scenario: Post Comments Read

## Metadata
- **Module:** Posts API — Comments Sub-resource
- **Priority:** P1
- **Type:** api
- **Tags:** api, comments, regression, posts

## API Behavior: mock

## Application
- **API Base URL:** {{ENV.API_BASE_URL}}
- **Authentication:** None — public API

## Pre-conditions
- API accessible at {{ENV.API_BASE_URL}}

## Steps

### Get comments for a known post (id=1)
1. API GET: {{ENV.API_BASE_URL}}/posts/1/comments
2. VERIFY: Response status is 200
3. VERIFY: Response body is an array
4. VERIFY: Response array length is greater than 0
5. VERIFY: Each item in the array contains fields: postId, id, name, email, body
6. VERIFY: Every item in the array has field "postId" equal to 1
7. CAPTURE: Response array length as {{commentCount}}

### Verify comment structure — spot check first comment
8. VERIFY: First item (index 0) field "postId" equals 1
9. VERIFY: First item (index 0) field "id" is an integer greater than 0
10. VERIFY: First item (index 0) field "name" is a non-empty string
11. VERIFY: First item (index 0) field "email" matches email format (contains "@")
12. VERIFY: First item (index 0) field "body" is a non-empty string

### Get comments for another post (id=5)
13. API GET: {{ENV.API_BASE_URL}}/posts/5/comments
14. VERIFY: Response status is 200
15. VERIFY: Response body is an array
16. VERIFY: Every item in the array has field "postId" equal to 5

### Get comments for a post at upper boundary (id=100)
17. API GET: {{ENV.API_BASE_URL}}/posts/100/comments
18. VERIFY: Response status is 200
19. VERIFY: Response body is an array

### Get comments for non-existent post (id=99999)
20. API GET: {{ENV.API_BASE_URL}}/posts/99999/comments
21. VERIFY: Response status is 200
22. VERIFY: Response body is an empty array []
<!-- NOTE: JSONPlaceholder returns 200 + empty array for posts with no comments or nonexistent
     post IDs — it does NOT return 404 on the sub-resource path. -->

### Verify comments are scoped to their parent post
23. API GET: {{ENV.API_BASE_URL}}/posts/1/comments
24. CAPTURE: Response all items $.postId as {{allPostIds}}
25. VERIFY: All captured postId values equal 1

## Test Data
| Field           | Value  | Notes                                             |
|-----------------|--------|---------------------------------------------------|
| postId1         | 1      | Known post — has comments                         |
| postId5         | 5      | Second post to verify cross-post isolation        |
| postId100       | 100    | Upper boundary post ID                            |
| postIdNoComments | 99999 | Non-existent post — returns empty array, not 404 |

## Notes
- GET /posts/{id}/comments is a read-only sub-resource — no POST/PUT/PATCH/DELETE available.
- JSONPlaceholder returns 200 + empty array (not 404) when the parent post has no comments or doesn't exist.
- The `email` field in Comment schema uses format "email" — verified by "@" presence check.
- Comment schema required fields: postId (int), id (int), name (string), email (string), body (string).
