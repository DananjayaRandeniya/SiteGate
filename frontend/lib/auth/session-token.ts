import { createHmac, timingSafeEqual } from "node:crypto";

export type PortalRole = "Admin" | "Manager";

export const portalSessionCookie = "sitegate_session";
export const portalSessionDuration = 8 * 60 * 60;

export function isPortalRole(role: unknown): role is PortalRole {
  return role === "Admin" || role === "Manager";
}

export function getPortalSessionSecret() {
  const secret = process.env.SITEGATE_MOCK_SESSION_SECRET?.trim();
  return secret && Buffer.byteLength(secret) >= 32 ? secret : null;
}

function signature(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function createPortalSessionToken(role: PortalRole, secret: string) {
  const expiresAt = Math.floor(Date.now() / 1000) + portalSessionDuration;
  const payload = Buffer.from(JSON.stringify({ role, expiresAt })).toString(
    "base64url",
  );
  return `${payload}.${signature(payload, secret)}`;
}

export function readPortalSessionToken(
  token: string | undefined,
  secret: string,
): PortalRole | null {
  if (!token || token.length > 512) return null;
  const [payload, mac, extra] = token.split(".");
  if (!payload || !mac || extra !== undefined) return null;
  const expected = Buffer.from(signature(payload, secret));
  const received = Buffer.from(mac);
  if (
    expected.length !== received.length ||
    !timingSafeEqual(expected, received)
  )
    return null;

  try {
    const { role, expiresAt } = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    );
    if (
      !isPortalRole(role) ||
      !Number.isSafeInteger(expiresAt) ||
      expiresAt <= Math.floor(Date.now() / 1000)
    )
      return null;
    return role;
  } catch {
    return null;
  }
}
