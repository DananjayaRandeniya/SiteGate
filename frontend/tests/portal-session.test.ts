import { afterEach, expect, test, vi } from "vitest";
import {
  createPortalSessionToken,
  getPortalSessionSecret,
  portalSessionDuration,
  readPortalSessionToken,
} from "@/lib/auth/session-token";

const secret = "a".repeat(32);

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

test.each(["Admin", "Manager"] as const)(
  "verifies a signed %s session",
  (role) => {
    const token = createPortalSessionToken(role, secret);
    expect(readPortalSessionToken(token, secret)).toBe(role);
  },
);

test("rejects a changed role or a cookie signed with a different key", () => {
  const token = createPortalSessionToken("Manager", secret);
  const [payload, mac] = token.split(".");
  const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  const changed = Buffer.from(
    JSON.stringify({ ...data, role: "Admin" }),
  ).toString("base64url");

  expect(readPortalSessionToken(`${changed}.${mac}`, secret)).toBeNull();
  expect(readPortalSessionToken(token, "b".repeat(32))).toBeNull();
  expect(readPortalSessionToken("Admin", secret)).toBeNull();
});

test("rejects a session at its expiry", () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-27T00:00:00Z"));
  const token = createPortalSessionToken("Admin", secret);
  vi.setSystemTime(Date.now() + portalSessionDuration * 1000);
  expect(readPortalSessionToken(token, secret)).toBeNull();
});

test("requires an explicit secret to enable training sign-in", () => {
  vi.stubEnv("SITEGATE_MOCK_SESSION_SECRET", "example");
  expect(getPortalSessionSecret()).toBeNull();
  vi.stubEnv("SITEGATE_MOCK_SESSION_SECRET", secret);
  expect(getPortalSessionSecret()).toBe(secret);
});
