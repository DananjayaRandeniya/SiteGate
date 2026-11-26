import { z } from "zod";
import { workerDirectoryQuery } from "./directory-query";
import {
  deactivateWorkerSchema,
  deactivatedWorkerSchema,
  issueCredentialSchema,
  issuedCredentialSchema,
  revokeCredentialSchema,
  revokedCredentialSchema,
  updateWorkerSchema,
} from "./worker-lifecycle";
import { workerRegistrationSchema } from "./worker-registration";
import {
  contractorListSchema,
  workerDirectorySchema,
  workerIdSchema,
  workerProfileSchema,
} from "./worker-schemas";

const workerApiErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  fieldErrors: z.record(z.string(), z.array(z.string())).optional(),
  correlationId: z.string().optional(),
});
type WorkerApiError = z.infer<typeof workerApiErrorSchema>;

export class WorkerPortalApiError extends Error {
  constructor(
    readonly status: number,
    readonly details: WorkerApiError,
  ) {
    super(details.message);
    this.name = "WorkerPortalApiError";
  }
}

type Submission = {
  method: "POST" | "PATCH";
  body: unknown;
  expected: 200 | 201;
  unconfirmedMessage?: string;
};

async function workerRequest<T>(
  path: string,
  schema: z.ZodType<T>,
  submission?: Submission,
): Promise<T> {
  const unavailable = submission
    ? {
        code: "WORKER_CHANGE_UNCONFIRMED",
        message:
          submission.unconfirmedMessage ??
          "Could not confirm the change. Check the worker profile before trying again.",
      }
    : {
        code: "WORKER_PORTAL_UNAVAILABLE",
        message: "Could not load worker data. Try again.",
      };

  let response: Response;
  try {
    response = await fetch(
      path,
      submission
        ? {
            method: submission.method,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(submission.body),
          }
        : { cache: "no-store" },
    );
  } catch {
    throw new WorkerPortalApiError(503, unavailable);
  }

  const body: unknown = await response.json().catch(() => undefined);
  if (!response.ok) {
    throw new WorkerPortalApiError(
      response.status,
      workerApiErrorSchema.safeParse(body).data ?? unavailable,
    );
  }

  const data = schema.safeParse(body);
  if (response.status !== (submission?.expected ?? 200) || !data.success) {
    throw new WorkerPortalApiError(502, unavailable);
  }
  return data.data;
}

function workerApiPath(id: string) {
  return `/api/workers/${workerIdSchema.parse(id).toLowerCase()}`;
}

export function loadWorkerDirectory(
  params: Parameters<typeof workerDirectoryQuery>[0],
) {
  return workerRequest(
    `/api/workers?${workerDirectoryQuery(params)}`,
    workerDirectorySchema,
  );
}

export function loadWorkerProfile(id: string) {
  return workerRequest(workerApiPath(id), workerProfileSchema);
}

export function loadWorkerContractors() {
  return workerRequest("/api/contractors", contractorListSchema);
}

export function submitWorkerRegistration(
  input: z.input<typeof workerRegistrationSchema>,
) {
  return workerRequest("/api/workers", workerProfileSchema, {
    method: "POST",
    body: workerRegistrationSchema.parse(input),
    expected: 201,
    unconfirmedMessage:
      "Could not confirm the registration. Check the worker directory before trying again.",
  });
}

export function submitWorkerUpdate(
  id: string,
  input: z.input<typeof updateWorkerSchema>,
) {
  return workerRequest(workerApiPath(id), workerProfileSchema, {
    method: "PATCH",
    body: updateWorkerSchema.parse(input),
    expected: 200,
  });
}

export function submitCredentialIssue(
  id: string,
  input: z.input<typeof issueCredentialSchema>,
) {
  return workerRequest(
    `${workerApiPath(id)}/credentials`,
    issuedCredentialSchema,
    {
      method: "POST",
      body: issueCredentialSchema.parse(input),
      expected: 201,
    },
  );
}

export function submitCredentialRevocation(
  id: string,
  input: z.input<typeof revokeCredentialSchema>,
) {
  return workerRequest(
    `${workerApiPath(id)}/credentials/revoke`,
    revokedCredentialSchema,
    {
      method: "POST",
      body: revokeCredentialSchema.parse(input),
      expected: 200,
    },
  );
}

export function submitWorkerDeactivation(
  id: string,
  input: z.input<typeof deactivateWorkerSchema>,
) {
  return workerRequest(
    `${workerApiPath(id)}/deactivate`,
    deactivatedWorkerSchema,
    {
      method: "PATCH",
      body: deactivateWorkerSchema.parse(input),
      expected: 200,
    },
  );
}
