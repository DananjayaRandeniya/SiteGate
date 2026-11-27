import "server-only";
import { z } from "zod";

const accessUrl = process.env.ACCESS_SERVICE_URL || "http://127.0.0.1:3002";
const auditUrl = process.env.AUDIT_SERVICE_URL || "http://127.0.0.1:3003";
const timestamp = z.iso.datetime();
const alertStatus = z.enum(["Open", "Acknowledged", "Resolved"]);
const alert = z.object({
  id: z.string(),
  type: z.string(),
  severity: z.string(),
  status: alertStatus,
  credentialNumber: z.string(),
  siteId: z.string(),
  workerId: z.string().optional(),
  gateId: z.string().optional(),
  createdAt: timestamp,
});
const auditEvent = z.object({
  eventId: z.string(),
  eventType: z.string(),
  occurredAt: timestamp,
  source: z.string(),
  payload: z.record(z.string(), z.unknown()),
});
const presence = z.object({
  workerId: z.string(),
  name: z.string().optional(),
  contractorId: z.string().optional(),
  enteredAt: timestamp,
});

function paged<T>(entry: z.ZodType<T>) {
  return z.object({
    data: z.array(entry),
    page: z.number().int().positive(),
    pageSize: z.number().int().positive(),
    total: z.number().int().nonnegative(),
  });
}

async function request<T>(
  base: string,
  path: string,
  schema: z.ZodType<T>,
  options?: { method: "POST" | "PATCH"; body: unknown },
): Promise<T> {
  const response = await fetch(new URL(path, base), {
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(5000),
    headers: {
      Accept: "application/json",
      ...(options && { "Content-Type": "application/json" }),
    },
    method: options?.method,
    body: options && JSON.stringify(options.body),
  });
  if (!response.ok) throw new Error(`Service returned HTTP ${response.status}`);
  return schema.parse(await response.json());
}

export function getOnSite(siteId: string) {
  return request(
    accessUrl,
    `/sites/${encodeURIComponent(siteId)}/on-site`,
    z.array(presence),
  );
}

export function runGateRequest(input: {
  credentialNumber: string;
  siteId: string;
  gateId: string;
  direction: "ENTRY" | "EXIT";
}) {
  return request(
    accessUrl,
    "/access-requests",
    z.object({
      result: z.enum(["GRANTED", "DENIED"]),
      reasonCode: z.string().nullish(),
    }),
    { method: "POST", body: input },
  );
}

export function getAlerts(query: URLSearchParams) {
  return request(auditUrl, `/alerts?${query}`, paged(alert));
}

export function changeAlertStatus(
  id: string,
  status: "Acknowledged" | "Resolved",
) {
  return request(auditUrl, `/alerts/${encodeURIComponent(id)}/status`, alert, {
    method: "PATCH",
    body: { status },
  });
}

export function getWorkerAudit(id: string, page: number) {
  const query = new URLSearchParams({ page: String(page), pageSize: "20" });
  return request(
    auditUrl,
    `/workers/${encodeURIComponent(id)}/audit?${query}`,
    paged(auditEvent),
  );
}
