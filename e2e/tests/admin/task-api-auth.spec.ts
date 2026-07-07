import { test as base, expect, request } from "@playwright/test";

// admin/src/app/api/tasks/[id]/route.ts has no auth check on GET/PUT/DELETE
// (unlike the agent app's equivalent, which requires getCurrentAgent() and
// an authorization relationship). These tests use a plain, cookie-less
// request context to check whether that gap is real.
base.describe("Admin - Task API authorization (unauthenticated access)", () => {
  base(
    "GET /api/tasks/[id] without any session should require auth",
    async ({ baseURL }) => {
      const anonymous = await request.newContext({ baseURL });
      // Any existing task id will do for this check; a random-looking id
      // is enough to hit the route and observe the auth behavior even if
      // the task itself doesn't exist for this particular id.
      const response = await anonymous.get("/api/tasks/000000000000000000000000");
      // Expected: 401 Unauthorized. If this fails with 200/404 instead of
      // 401, the route is reachable without any authentication.
      expect(response.status()).toBe(401);
      await anonymous.dispose();
    }
  );

  base(
    "DELETE /api/tasks/[id] without any session should require auth",
    async ({ baseURL }) => {
      const anonymous = await request.newContext({ baseURL });
      const response = await anonymous.delete(
        "/api/tasks/000000000000000000000000"
      );
      expect(response.status()).toBe(401);
      await anonymous.dispose();
    }
  );
});
