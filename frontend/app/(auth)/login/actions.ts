"use server";

import { cookies } from "next/headers";
import { redirect, RedirectType } from "next/navigation";
import {
  createPortalSessionToken,
  getPortalSessionSecret,
  isPortalRole,
  portalSessionCookie,
  portalSessionDuration,
} from "@/lib/auth/session-token";

export async function signIn(form: FormData) {
  const secret = getPortalSessionSecret();
  if (!secret) redirect("/login?error=unavailable");
  const role = form.get("role");
  if (!isPortalRole(role)) redirect("/login?error=role");

  (await cookies()).set(
    portalSessionCookie,
    createPortalSessionToken(role, secret),
    {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: portalSessionDuration,
    },
  );
  redirect("/", RedirectType.replace);
}

export async function signOut() {
  (await cookies()).delete(portalSessionCookie);
  redirect("/login", RedirectType.replace);
}
