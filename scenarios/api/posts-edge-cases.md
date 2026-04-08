# Scenario: Posts Edge Cases

## Metadata
- **Module:** Posts API
- **Priority:** P2
- **Type:** api
- **Tags:** api, edge-case, regression, posts

## API Behavior: mock

## Application
- **API Base URL:** {{ENV.API_BASE_URL}}
- **Authentication:** None — public API

## Pre-conditions
- API accessible at {{ENV.API_BASE_URL}}

## Steps

### POST — Only required fields (no optional fields)
1. API POST: {{ENV.API_BASE_URL}}/posts with body {"title": "Minimal Post", "body": "Minimal body.", "userId": 1}
2. VERIFY: Response status is 201
3. VERIFY: Response body contains field "id" with value 101
4. VERIFY: Response body contains field "title" with value "Minimal Post"
5. VERIFY: Response body contains field "body" with value "Minimal body."
6. VERIFY: Response body contains field "userId" with value 1

### POST — Very long string values (boundary check)
7. API POST: {{ENV.API_BASE_URL}}/posts with body {"title": "A very long title that contains exactly two hundred and fifty five characters in it and is designed to test the maximum boundary of the title field for any potential truncation or validation issues AAAA", "body": "An equally long body field content designed to check that the API properly handles large text payloads without truncating, rejecting, or corrupting the content in any way shape or form. Lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.", "userId": 1}
8. VERIFY: Response status is 201
9. VERIFY: Response body field "title" is not truncated (matches sent value)
10. VERIFY: Response body field "body" is not truncated (matches sent value)

### POST — Special characters in string fields (XSS and injection safety)
11. API POST: {{ENV.API_BASE_URL}}/posts with body {"title": "<script>alert('xss')</script>", "body": "SELECT * FROM posts WHERE id=1; DROP TABLE posts;--", "userId": 1}
12. VERIFY: Response status is 201
13. VERIFY: Response body field "title" is returned as-is (not executed)
14. VERIFY: Response body field "body" is returned as-is (not executed)

### POST — Unicode characters in string fields
15. API POST: {{ENV.API_BASE_URL}}/posts with body {"title": "Título con acentos: ñ, ü, ø, 日本語, 中文, العربية", "body": "Unicode emoji: 🎉🚀✅ and math symbols: ∑∞±", "userId": 1}
16. VERIFY: Response status is 201
17. VERIFY: Response body field "title" contains unicode characters correctly (no mojibake)
18. VERIFY: Response body field "body" contains emoji and symbols correctly

### POST — userId at lower boundary (userId=1)
19. API POST: {{ENV.API_BASE_URL}}/posts with body {"title": "Boundary userId Low", "body": "Testing userId boundary.", "userId": 1}
20. VERIFY: Response status is 201
21. VERIFY: Response body contains field "userId" with value 1

### POST — userId at upper boundary (userId=10)
22. API POST: {{ENV.API_BASE_URL}}/posts with body {"title": "Boundary userId High", "body": "Testing userId upper boundary.", "userId": 10}
23. VERIFY: Response status is 201
24. VERIFY: Response body contains field "userId" with value 10

### PATCH — Update only one field (partial update)
25. API PATCH: {{ENV.API_BASE_URL}}/posts/1 with body {"title": "Only Title Changed"}
26. VERIFY: Response status is 200
27. VERIFY: Response body contains field "title" with value "Only Title Changed"
28. VERIFY: Response body contains field "id" with value 1
29. VERIFY: Response body contains field "userId" (value preserved from original)
30. VERIFY: Response body contains field "body" (value preserved from original)

### PATCH — Update only body field
31. API PATCH: {{ENV.API_BASE_URL}}/posts/1 with body {"body": "Only body changed, title untouched."}
32. VERIFY: Response status is 200
33. VERIFY: Response body contains field "body" with value "Only body changed, title untouched."
34. VERIFY: Response body contains field "title" (value preserved from original)

### GET — Boundary post IDs
35. API GET: {{ENV.API_BASE_URL}}/posts/1
36. VERIFY: Response status is 200
37. VERIFY: Response body field "id" equals 1
38. API GET: {{ENV.API_BASE_URL}}/posts/100
39. VERIFY: Response status is 200
40. VERIFY: Response body field "id" equals 100
41. API GET: {{ENV.API_BASE_URL}}/posts/101
42. VERIFY: Response status is 404

## Test Data
| Field           | Value                                          | Notes                                    |
|-----------------|------------------------------------------------|------------------------------------------|
| longTitle       | 200+ character string                          | Max boundary test for title field        |
| xssTitle        | `<script>alert('xss')</script>`                | XSS injection probe — must be stored safely |
| sqlBody         | `SELECT * FROM posts WHERE id=1; DROP TABLE posts;--` | SQL injection probe |
| unicodeTitle    | Título con acentos: ñ, ü, ø, 日本語, 中文, العربية | Multi-script unicode           |
| emojiBody       | Unicode emoji: 🎉🚀✅ and math symbols: ∑∞±   | Emoji and special symbols                |
| userIdLow       | 1                                              | Lower boundary per spec (1–10)           |
| userIdHigh      | 10                                             | Upper boundary per spec (1–10)           |
| boundaryLowId   | 1                                              | First valid post ID                      |
| boundaryHighId  | 100                                            | Last valid post ID                       |
| boundaryOverId  | 101                                            | Just above max — expect 404              |

## Notes
- Steps 11–14 probe for output encoding — JSONPlaceholder stores and echoes values verbatim.
  A production API must HTML-encode output in HTML contexts; this test verifies raw API storage.
- Steps 25–34 verify PATCH semantics: only sent fields are changed, others preserved.
- Steps 35–42 verify boundary behavior: id=101 returns 404 per spec documentation.
- POST with userId > 10 is not explicitly constrained in JSONPlaceholder — documenting behavior.
