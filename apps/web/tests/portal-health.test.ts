import { expect, test } from "vitest";
import { GET } from "@/app/api/health/route";

test("returns JSON when the portal is running", async () => {
  const response = GET();
  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toContain("application/json");
  await expect(response.json()).resolves.toEqual({ status: "ok" });
});
