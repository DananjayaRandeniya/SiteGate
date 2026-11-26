import type { NextRequest } from "next/server";

export function isSamePortalOrigin(request: NextRequest) {
  const { protocol, host } = request.nextUrl;
  const requestHost = request.headers.get("host") ?? host;
  return request.headers.get("origin") === `${protocol}//${requestHost}`;
}

export function isJsonRequest(request: Request) {
  const contentType = request.headers.get("content-type")?.split(";")[0];
  return contentType?.trim().toLowerCase() === "application/json";
}
