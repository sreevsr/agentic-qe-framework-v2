import { test, expect } from '@playwright/test';
import testData from '../../test-data/api/posts-crud-happy-path.json';

// ── Interfaces ─────────────────────────────────────────────────────────────────
interface Post {
  id: number;
  title: string;
  body: string;
  userId: number;
}

// ── CAPTURE variables — must be let in outer test scope ────────────────────────
let postId: number;
let existingUserId: number;

// ── Response storage — outer scope for cross-step access ──────────────────────
let postCreateStatus: number;
let postCreateBody: Post;
let postGetStatus: number;
let postGetBody: Post;
let putStatus: number;
let putBody: Post;
let patchStatus: number;
let patchBody: Post;
let deleteStatus: number;
let deleteBody: Record<string, unknown>;

// ── API Behavior: mock ─────────────────────────────────────────────────────────
// JSONPlaceholder fakes all mutating operations:
//   POST  always returns id=101
//   PUT/PATCH/DELETE return correct-shaped responses but data is NOT persisted
// ──────────────────────────────────────────────────────────────────────────────

test.describe('Posts API', () => {
  test(
    'Posts CRUD Happy Path',
    { tag: ['@api', '@crud', '@smoke', '@posts', '@P0'] },
    async ({ request }) => {

      // ── Create a new post ──────────────────────────────────────────────────

      await test.step('Step 1 — API POST: Create new post at /posts', async () => {
        const response = await request.post(`${process.env.API_BASE_URL}/posts`, {
          data: {
            title: testData.createTitle,
            body: testData.createBody,
            userId: testData.createUserId,
          },
        });
        postCreateStatus = response.status();
        postCreateBody = await response.json() as Post;
      });

      await test.step('Step 2 — VERIFY: Response status is 201', async () => {
        expect(postCreateStatus).toBe(201);
      });

      await test.step(`Step 3 — VERIFY: Response body contains field "id" with value ${testData.postId}`, async () => {
        // API Behavior: mock — JSONPlaceholder always returns id=101 for POST
        expect(postCreateBody.id).toBe(testData.postId);
      });

      await test.step(`Step 4 — VERIFY: Response body contains field "title" with value "${testData.createTitle}"`, async () => {
        expect(postCreateBody.title).toBe(testData.createTitle);
      });

      await test.step(`Step 5 — VERIFY: Response body contains field "body" with value "${testData.createBody}"`, async () => {
        expect(postCreateBody.body).toBe(testData.createBody);
      });

      await test.step(`Step 6 — VERIFY: Response body contains field "userId" with value ${testData.createUserId}`, async () => {
        expect(postCreateBody.userId).toBe(testData.createUserId);
      });

      await test.step('Step 7 — CAPTURE: Response $.id as postId', async () => {
        postId = postCreateBody.id;
      });

      // ── Read an existing post ──────────────────────────────────────────────

      await test.step(`Step 8 — API GET: Fetch post by id=${testData.stableId}`, async () => {
        const response = await request.get(
          `${process.env.API_BASE_URL}/posts/${testData.stableId}`,
        );
        postGetStatus = response.status();
        postGetBody = await response.json() as Post;
      });

      await test.step('Step 9 — VERIFY: Response status is 200', async () => {
        expect(postGetStatus).toBe(200);
      });

      await test.step('Step 10 — VERIFY: Response body contains fields: id, userId, title, body', async () => {
        expect(postGetBody).toMatchObject({
          id: expect.any(Number),
          userId: expect.any(Number),
          title: expect.any(String),
          body: expect.any(String),
        });
      });

      await test.step(`Step 11 — VERIFY: Response body field "id" equals ${testData.stableId}`, async () => {
        expect(postGetBody.id).toBe(testData.stableId);
      });

      await test.step('Step 12 — CAPTURE: Response $.userId as existingUserId', async () => {
        existingUserId = postGetBody.userId;
      });

      // ── Replace post entirely (PUT) ────────────────────────────────────────

      await test.step(`Step 13 — API PUT: Replace post id=${testData.stableId}`, async () => {
        const response = await request.put(
          `${process.env.API_BASE_URL}/posts/${testData.stableId}`,
          {
            data: {
              title: testData.replaceTitle,
              body: testData.replaceBody,
              userId: testData.replaceUserId,
            },
          },
        );
        putStatus = response.status();
        putBody = await response.json() as Post;
      });

      await test.step('Step 14 — VERIFY: Response status is 200', async () => {
        expect(putStatus).toBe(200);
      });

      await test.step(`Step 15 — VERIFY: Response body contains field "title" with value "${testData.replaceTitle}"`, async () => {
        expect(putBody.title).toBe(testData.replaceTitle);
      });

      await test.step(`Step 16 — VERIFY: Response body contains field "body" with value "${testData.replaceBody}"`, async () => {
        expect(putBody.body).toBe(testData.replaceBody);
      });

      await test.step(`Step 17 — VERIFY: Response body contains field "userId" with value ${testData.replaceUserId}`, async () => {
        expect(putBody.userId).toBe(testData.replaceUserId);
      });

      await test.step(`Step 18 — VERIFY: Response body contains field "id" with value ${testData.stableId}`, async () => {
        expect(putBody.id).toBe(testData.stableId);
      });

      // ── Partially update a post (PATCH) ────────────────────────────────────

      await test.step(`Step 19 — API PATCH: Partially update post id=${testData.stableId}`, async () => {
        const response = await request.patch(
          `${process.env.API_BASE_URL}/posts/${testData.stableId}`,
          {
            data: {
              title: testData.patchTitle,
            },
          },
        );
        patchStatus = response.status();
        patchBody = await response.json() as Post;
      });

      await test.step('Step 20 — VERIFY: Response status is 200', async () => {
        expect(patchStatus).toBe(200);
      });

      await test.step(`Step 21 — VERIFY: Response body contains field "title" with value "${testData.patchTitle}"`, async () => {
        expect(patchBody.title).toBe(testData.patchTitle);
      });

      await test.step(`Step 22 — VERIFY: Response body contains field "id" with value ${testData.stableId}`, async () => {
        expect(patchBody.id).toBe(testData.stableId);
      });

      // ── Delete a post ──────────────────────────────────────────────────────

      await test.step(`Step 23 — API DELETE: Delete post id=${testData.stableId}`, async () => {
        const response = await request.delete(
          `${process.env.API_BASE_URL}/posts/${testData.stableId}`,
        );
        deleteStatus = response.status();
        deleteBody = await response.json() as Record<string, unknown>;
      });

      await test.step('Step 24 — VERIFY: Response status is 200', async () => {
        expect(deleteStatus).toBe(200);
      });

      await test.step('Step 25 — VERIFY: Response body is empty object {}', async () => {
        // API Behavior: mock — JSONPlaceholder returns {} for successful DELETE
        expect(deleteBody).toEqual({});
      });
    },
  );
});
