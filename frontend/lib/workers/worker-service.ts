import "server-only";

import { z } from "zod";
import { workerDirectoryQuery } from "./directory-query";
import {
  archiveWorkerSchema,
  deactivateWorkerSchema,
  deactivatedWorkerSchema,
  issueCredentialSchema,
  issuedCredentialSchema,
  revokeCredentialSchema,
  revokedCredentialSchema,
  updateWorkerSchema,
  workerSiteChangeSchema,
  workerSitesSchema,
} from "./worker-lifecycle";
import { workerRegistrationSchema } from "./worker-registration";
import {
  contractorListSchema,
  workerDirectorySchema,
  workerIdSchema,
  workerProfileSchema,
} from "./worker-schemas";

const DEFAULT_WORKER_SERVICE_URL = "http://127.0.0.1:3001";
const REQUEST_TIMEOUT_MS = 5000;

const serviceErrorSchema = z.object({
  code: z.string().regex(/^[A-Z][A-Z0-9_]{0,79}$/),
  correlationId: z.uuid().optional(),
});

const workerErrorMessages = new Map([
  ["WORKER_NOT_FOUND", "Worker was not found."],
  ["CREDENTIAL_IN_USE", "This credential is already in use"],
  [
    "CREDENTIAL_NOT_ACTIVE",
    "This credential is no longer active for this worker.",
  ],
  ["CONTRACTOR_NOT_FOUND", "Choose an active contractor."],
  [
    "REGISTRATION_EVENT_UNCONFIRMED",
    "The worker was saved, but we could not confirm the registration event. Check the directory before trying again.",
  ],
  [
    "WORKER_UPDATE_EVENT_UNCONFIRMED",
    "The profile was saved, but the update event could not be confirmed. Check the profile before trying again.",
  ],
  [
    "CREDENTIAL_EVENT_UNCONFIRMED",
    "The credential change was saved, but its event could not be confirmed. Check the profile before trying again.",
  ],
  [
    "WORKER_DEACTIVATION_EVENT_UNCONFIRMED",
    "The worker was made inactive, but the event could not be confirmed. Check the profile before trying again.",
  ],
]);

export class WorkerServiceError extends Error {
  readonly status: number;
  readonly code: string;
  readonly correlationId?: string;

  constructor(status: number, code: string, correlationId?: string) {
    super(
      workerErrorMessages.get(code) ??
        "Could not complete the Worker Service request.",
    );
    this.name = "WorkerServiceError";
    this.status = status;
    this.code = code;
    this.correlationId = correlationId;
  }
}

async function requestWorkerService<T>(
  path: string,
  schema: z.ZodType<T>,
  options: { query?: URLSearchParams; init?: RequestInit } = {},
): Promise<T> {
  const headers = new Headers(options.init?.headers);
  headers.set("Accept", "application/json");

  let response: Response;
  try {
    const url = new URL(
      path,
      process.env.WORKER_SERVICE_URL || DEFAULT_WORKER_SERVICE_URL,
    );
    url.search = options.query?.toString() ?? "";
    response = await fetch(url, {
      ...options.init,
      headers,
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    throw new WorkerServiceError(503, "WORKER_SERVICE_UNAVAILABLE");
  }

  let body: unknown;
  try {
    body = response.status === 204 ? undefined : await response.json();
  } catch {
    throw new WorkerServiceError(502, "WORKER_SERVICE_INVALID_RESPONSE");
  }

  if (!response.ok) {
    const error = serviceErrorSchema.safeParse(body);
    throw new WorkerServiceError(
      response.status,
      error.data?.code ?? "WORKER_SERVICE_ERROR",
      error.data?.correlationId,
    );
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new WorkerServiceError(502, "WORKER_SERVICE_INVALID_RESPONSE");
  }
  return parsed.data;
}

export function getWorkerDirectory(
  params: Parameters<typeof workerDirectoryQuery>[0],
) {
  return requestWorkerService("/workers", workerDirectorySchema, {
    query: workerDirectoryQuery(params),
  });
}

function workerPath(workerId: string) {
  const id = workerIdSchema.safeParse(workerId);
  if (!id.success) {
    throw new WorkerServiceError(404, "WORKER_NOT_FOUND");
  }
  return `/workers/${id.data.toLowerCase()}`;
}

export async function getWorkerProfile(workerId: string) {
  return requestWorkerService(workerPath(workerId), workerProfileSchema);
}

export function getContractors() {
  return requestWorkerService("/contractors", contractorListSchema);
}

async function changeWorker<T>(
  path: string,
  method: "POST" | "PATCH" | "DELETE",
  input: unknown,
  response: z.ZodType<T>,
) {
  const token = process.env.WORKER_ADMIN_TOKEN?.trim();
  if (!token) {
    throw new WorkerServiceError(503, "WORKER_SERVICE_UNAVAILABLE");
  }

  return requestWorkerService(path, response, {
    init: {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    },
  });
}

export async function registerWorker(input: unknown) {
  return changeWorker(
    "/workers",
    "POST",
    workerRegistrationSchema.parse(input),
    workerProfileSchema,
  );
}

export async function updateWorker(id: string, input: unknown) {
  return changeWorker(
    workerPath(id),
    "PATCH",
    updateWorkerSchema.parse(input),
    workerProfileSchema,
  );
}

export async function issueCredential(id: string, input: unknown) {
  return changeWorker(
    `${workerPath(id)}/credentials`,
    "POST",
    issueCredentialSchema.parse(input),
    issuedCredentialSchema,
  );
}

export async function revokeCredential(id: string, input: unknown) {
  return changeWorker(
    `${workerPath(id)}/credentials/revoke`,
    "POST",
    revokeCredentialSchema.parse(input),
    revokedCredentialSchema,
  );
}

export async function deactivateWorker(id: string, input: unknown) {
  return changeWorker(
    `${workerPath(id)}/deactivate`,
    "PATCH",
    deactivateWorkerSchema.parse(input),
    deactivatedWorkerSchema,
  );
}

export async function changeWorkerSite(
  id: string,
  method: "POST" | "DELETE",
  input: unknown,
) {
  return changeWorker(
    `${workerPath(id)}/sites`,
    method,
    workerSiteChangeSchema.parse(input),
    workerSitesSchema,
  );
}

export async function archiveWorker(id: string, input: unknown) {
  return changeWorker(
    workerPath(id),
    "DELETE",
    archiveWorkerSchema.parse(input),
    z.undefined(),
  );
}
