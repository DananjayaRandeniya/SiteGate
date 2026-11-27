import { NextRequest } from "next/server";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { GET as getContractors } from "@/app/api/contractors/route";
import { POST as issue } from "@/app/api/workers/[id]/credentials/route";
import { POST as revoke } from "@/app/api/workers/[id]/credentials/revoke/route";
import { PATCH as deactivate } from "@/app/api/workers/[id]/deactivate/route";
import {
  GET as getWorker,
  PATCH as update,
} from "@/app/api/workers/[id]/route";
import {
  GET as listWorkers,
  POST as createWorker,
} from "@/app/api/workers/route";
import { getWorkerPortalRole } from "@/lib/workers/worker-access";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/workers/worker-access", () => ({
  getWorkerPortalRole: vi.fn(),
}));

const origin = "http://localhost:3000";
const workerId = "111111111111111111111111";
const contractorId = "222222222222222222222222";
const registration = {
  fullName: " Test Worker ",
  contractorId,
  credentialNumber: "Test-001",
  inductionDate: "2020-01-01",
  safetyTicketExpiry: "2030-01-01",
};
const worker = {
  ...registration,
  fullName: "Test Worker",
  id: workerId,
  assignedSiteIds: [],
  status: "Active",
};
const sendToWorkerService = vi.fn<typeof fetch>();

const changedAt = "2026-11-26T11:00:00.000Z";
const actions = [
  {
    handler: update,
    suffix: "",
    method: "PATCH",
    input: { fullName: "Updated Worker" },
    output: { ...worker, fullName: "Updated Worker" },
    status: 200,
  },
  {
    handler: issue,
    suffix: "/credentials",
    method: "POST",
    input: { credentialNumber: "Test-002" },
    output: { credentialNumber: "Test-002", issuedAt: changedAt },
    status: 201,
  },
  {
    handler: revoke,
    suffix: "/credentials/revoke",
    method: "POST",
    input: { credentialNumber: "Test-002", reason: "LOST" },
    output: {
      credentialNumber: "Test-002",
      reason: "LOST",
      revokedAt: changedAt,
    },
    status: 200,
  },
  {
    handler: deactivate,
    suffix: "/deactivate",
    method: "PATCH",
    input: { reason: "LEFT_COMPANY" },
    output: { id: workerId, status: "Inactive" },
    status: 200,
  },
] as const;

function register(input: unknown, source = origin) {
  return createWorker(
    new NextRequest(`${origin}/api/workers`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: source },
      body: JSON.stringify(input),
    }),
  );
}

beforeEach(() => {
  vi.mocked(getWorkerPortalRole).mockReset();
  sendToWorkerService.mockReset();
  vi.stubGlobal("fetch", sendToWorkerService);
  vi.stubEnv("WORKER_SERVICE_URL", "http://worker-service:3001");
  vi.stubEnv("WORKER_ADMIN_TOKEN", "test-token-only");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

test.each(actions)(
  "restricts $method /workers/:id$suffix to Admin",
  async ({ handler, suffix, method, input, output, status }) => {
    const request = () =>
      new NextRequest(`${origin}/api/workers/${workerId}${suffix}`, {
        method,
        headers: { "Content-Type": "application/json", Origin: origin },
        body: JSON.stringify(input),
      });
    const context = { params: Promise.resolve({ id: workerId }) };
    vi.mocked(getWorkerPortalRole).mockResolvedValue("Manager");
    expect((await handler(request(), context)).status).toBe(403);
    expect(sendToWorkerService).not.toHaveBeenCalled();

    vi.mocked(getWorkerPortalRole).mockResolvedValue("Admin");
    sendToWorkerService.mockResolvedValue(Response.json(output, { status }));
    const response = await handler(request(), context);
    expect(response.status).toBe(status);
    await expect(response.json()).resolves.toEqual(output);
    const [url, init] = sendToWorkerService.mock.calls[0];
    expect(String(url)).toBe(
      `http://worker-service:3001/workers/${workerId}${suffix}`,
    );
    expect(init?.method).toBe(method);
    expect(new Headers(init?.headers).get("Authorization")).toBe(
      "Bearer test-token-only",
    );
    expect(JSON.parse(String(init?.body))).toEqual(input);
  },
);

test("returns a revoke field error before contacting Worker Service", async () => {
  vi.mocked(getWorkerPortalRole).mockResolvedValue("Admin");
  const request = new NextRequest(
    `${origin}/api/workers/${workerId}/credentials/revoke`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: origin },
      body: JSON.stringify({ credentialNumber: "Test-002", reason: "UNKNOWN" }),
    },
  );
  const response = await revoke(request, {
    params: Promise.resolve({ id: workerId }),
  });
  expect(response.status).toBe(400);
  await expect(response.json()).resolves.toMatchObject({
    code: "VALIDATION_ERROR",
    fieldErrors: { reason: expect.any(Array) },
  });
  expect(sendToWorkerService).not.toHaveBeenCalled();
});

test("requires a session for Worker data", async () => {
  vi.mocked(getWorkerPortalRole).mockResolvedValue(null);
  expect(
    (await listWorkers(new NextRequest(`${origin}/api/workers`))).status,
  ).toBe(401);
  expect((await getContractors()).status).toBe(401);
  expect(sendToWorkerService).not.toHaveBeenCalled();
});

test("lists workers for a Manager and forwards only supported query values", async () => {
  vi.mocked(getWorkerPortalRole).mockResolvedValue("Manager");
  const output = {
    items: [{ ...worker, contractorName: "Demo Contractor" }],
    page: 1,
    limit: 10,
    total: 1,
    totalPages: 1,
  };
  sendToWorkerService.mockResolvedValue(Response.json(output));
  const response = await listWorkers(
    new NextRequest(
      `${origin}/api/workers?page=2&page=5&limit=10&search=Test+Worker&status=Active&ignored=1`,
    ),
  );
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  await expect(response.json()).resolves.toEqual(output);
  const [url, init] = sendToWorkerService.mock.calls[0];
  expect(String(url)).toBe(
    "http://worker-service:3001/workers?page=1&limit=10&search=Test+Worker&status=Active",
  );
  expect(new Headers(init?.headers).has("Authorization")).toBe(false);
});

test("reads a profile and the contractor list for a signed-in user", async () => {
  vi.mocked(getWorkerPortalRole).mockResolvedValue("Manager");
  const contractors = [{ id: contractorId, name: "Demo Contractor" }];
  sendToWorkerService
    .mockResolvedValueOnce(Response.json(worker))
    .mockResolvedValueOnce(Response.json(contractors));
  const request = new NextRequest(`${origin}/api/workers/${workerId}`);
  const profile = await getWorker(request, {
    params: Promise.resolve({ id: workerId }),
  });
  await expect(profile.json()).resolves.toEqual(worker);
  await expect((await getContractors()).json()).resolves.toEqual(contractors);
});

test("rejects registration requested by a Manager or from another site", async () => {
  vi.mocked(getWorkerPortalRole).mockResolvedValue("Manager");
  expect((await register(registration)).status).toBe(403);
  vi.mocked(getWorkerPortalRole).mockResolvedValue("Admin");
  expect((await register(registration, "https://example.test")).status).toBe(
    403,
  );
  expect(sendToWorkerService).not.toHaveBeenCalled();
});

test("returns field errors before calling Worker Service", async () => {
  vi.mocked(getWorkerPortalRole).mockResolvedValue("Admin");
  const response = await register({
    ...registration,
    inductionDate: "2999-01-01",
  });
  expect(response.status).toBe(400);
  await expect(response.json()).resolves.toMatchObject({
    code: "VALIDATION_ERROR",
    fieldErrors: {
      inductionDate: ["Induction date must be today or earlier."],
    },
  });
  expect(sendToWorkerService).not.toHaveBeenCalled();
});

test("registers a worker for an Admin and keeps the service token on the server", async () => {
  vi.mocked(getWorkerPortalRole).mockResolvedValue("Admin");
  sendToWorkerService.mockResolvedValue(Response.json(worker, { status: 201 }));
  const response = await register(registration);
  expect(response.status).toBe(201);
  expect(response.headers.get("location")).toBe(`/api/workers/${workerId}`);
  await expect(response.json()).resolves.toEqual(worker);
  const [, init] = sendToWorkerService.mock.calls[0];
  expect(init?.method).toBe("POST");
  expect(new Headers(init?.headers).get("Authorization")).toBe(
    "Bearer test-token-only",
  );
  expect(JSON.parse(String(init?.body))).toEqual({
    ...registration,
    fullName: "Test Worker",
  });
});

test.each([
  [409, "CREDENTIAL_IN_USE", "This credential is already in use"],
  [503, "REGISTRATION_EVENT_UNCONFIRMED", "The worker was saved"],
])(
  "passes on the Worker Service status and code %s %s",
  async (status, code, message) => {
    vi.mocked(getWorkerPortalRole).mockResolvedValue("Admin");
    const correlationId = "5f200000-d2ea-475d-8146-3f53424fea3d";
    sendToWorkerService.mockResolvedValue(
      Response.json(
        { code, correlationId, message: "Worker Service detail" },
        { status },
      ),
    );
    const response = await register(registration);
    expect(response.status).toBe(status);
    await expect(response.json()).resolves.toMatchObject({
      code,
      correlationId,
      message: expect.stringContaining(message),
    });
  },
);
