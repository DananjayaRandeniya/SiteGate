import { afterEach, beforeEach, expect, test, vi } from "vitest";
import {
  loadWorkerContractors,
  loadWorkerDirectory,
  loadWorkerProfile,
  submitCredentialIssue,
  submitCredentialRevocation,
  submitWorkerDeactivation,
  submitWorkerUpdate,
} from "@/lib/workers/worker-portal-client";

const fetchPortal = vi.fn<typeof fetch>();
const id = "111111111111111111111111";
const contractorId = "222222222222222222222222";
const profile = {
  id,
  contractorId,
  fullName: "Demo Worker",
  status: "Active",
  credentialNumber: "DEMO-01",
  inductionDate: "2020-01-01",
  safetyTicketExpiry: "2035-01-01",
  assignedSiteIds: ["S-01"],
};
const base = `/api/workers/${id}`;
const timestamp = "2026-11-26T10:00:00.000Z";

beforeEach(() => {
  fetchPortal.mockReset();
  vi.stubGlobal("fetch", fetchPortal);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

test("encodes directory filters and reads Worker data through the portal", async () => {
  const result = {
    items: [{ ...profile, contractorName: "Demo Contractor" }],
    page: 2,
    limit: 10,
    total: 11,
    totalPages: 2,
  };
  fetchPortal.mockResolvedValueOnce(Response.json(result));
  fetchPortal.mockResolvedValueOnce(Response.json(profile));
  fetchPortal.mockResolvedValueOnce(
    Response.json([{ id: contractorId, name: "Demo Contractor" }]),
  );

  await expect(
    loadWorkerDirectory(
      new URLSearchParams("page=2&limit=10&search=R%26D&status=Active"),
    ),
  ).resolves.toEqual(result);
  await expect(loadWorkerProfile(id)).resolves.toEqual(profile);
  await expect(loadWorkerContractors()).resolves.toEqual([
    { id: contractorId, name: "Demo Contractor" },
  ]);
  expect(fetchPortal.mock.calls.map(([url]) => url)).toEqual([
    "/api/workers?page=2&limit=10&search=R%26D&status=Active",
    base,
    "/api/contractors",
  ]);
  expect(
    fetchPortal.mock.calls.every(([, opts]) => opts?.cache === "no-store"),
  ).toBe(true);
});

test("uses the four Worker profile actions with their expected requests", async () => {
  const uploadedProfile = { ...profile, fullName: "Updated" };
  const credential = { credentialNumber: "DEMO-02" };
  const revocation = { ...credential, reason: "LOST" } as const;
  const deactivation = { reason: "LEFT_COMPANY" } as const;
  fetchPortal.mockResolvedValueOnce(Response.json(uploadedProfile));
  fetchPortal.mockResolvedValueOnce(
    Response.json({ ...credential, issuedAt: timestamp }, { status: 201 }),
  );
  fetchPortal.mockResolvedValueOnce(
    Response.json({ ...revocation, revokedAt: timestamp }),
  );
  fetchPortal.mockResolvedValueOnce(Response.json({ id, status: "Inactive" }));

  await expect(
    submitWorkerUpdate(id, { fullName: " Updated " }),
  ).resolves.toEqual(uploadedProfile);
  await expect(submitCredentialIssue(id, credential)).resolves.toMatchObject(
    credential,
  );
  await expect(
    submitCredentialRevocation(id, revocation),
  ).resolves.toMatchObject(revocation);
  await expect(submitWorkerDeactivation(id, deactivation)).resolves.toEqual({
    id,
    status: "Inactive",
  });

  expect(
    fetchPortal.mock.calls.map(([url, opts]) => [
      url,
      opts?.method,
      JSON.parse(String(opts?.body)),
    ]),
  ).toEqual([
    [base, "PATCH", { fullName: "Updated" }],
    [base + "/credentials", "POST", credential],
    [base + "/credentials/revoke", "POST", revocation],
    [base + "/deactivate", "PATCH", deactivation],
  ]);
});

test("keeps the portal's conflict reason and trace ID available to the UI", async () => {
  const details = {
    code: "CREDENTIAL_NOT_ACTIVE",
    message: "This credential is no longer active for this worker.",
    correlationId: "5f200000-d2ea-475d-8146-3f53424fea3d",
  };
  fetchPortal.mockResolvedValueOnce(Response.json(details, { status: 409 }));
  await expect(
    submitCredentialRevocation(id, {
      credentialNumber: "DEMO-01",
      reason: "LOST",
    }),
  ).rejects.toMatchObject({ status: 409, details });
});

test("rejects malformed positive responses and does not retry a possibly saved action", async () => {
  fetchPortal.mockResolvedValueOnce(Response.json({ ok: true }));
  await expect(submitWorkerDeactivation(id, {})).rejects.toMatchObject({
    status: 502,
    details: { code: "WORKER_CHANGE_UNCONFIRMED" },
  });
  expect(fetchPortal).toHaveBeenCalledTimes(1);
});
