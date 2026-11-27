import { cookies } from "next/headers";
import {
  getPortalSessionSecret,
  portalSessionCookie,
  readPortalSessionToken,
} from "./session-token";

export async function getPortalRole() {
  const token = (await cookies()).get(portalSessionCookie)?.value;
  const secret = getPortalSessionSecret();
  if (!secret) return null;
  return readPortalSessionToken(token, secret);
}
