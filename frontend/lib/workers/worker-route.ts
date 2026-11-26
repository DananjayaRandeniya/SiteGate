import "server-only";

import type { NextRequest } from "next/server";
import { z } from "zod";
import { isJsonRequest, isSamePortalOrigin } from "@/lib/http/request";
import { getWorkerPortalRole } from "./worker-access";
import { WorkerServiceError } from "./worker-service";

export function workerJson(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

export function workerError(status: number, code: string, message: string) {
  return workerJson({ code, message }, status);
}

export async function withWorkerSession(
  operation: () => Promise<Response>,
  { adminOnly = false }: { adminOnly?: boolean } = {},
) {
  const role = await getWorkerPortalRole();
  if (!role) return workerError(401, "UNAUTHORIZED", "Sign in to continue.");
  if (adminOnly && role !== "Admin") {
    return workerError(
      403,
      "FORBIDDEN",
      "Only an Admin can change worker records.",
    );
  }

  try {
    return await operation();
  } catch (error) {
    if (error instanceof z.ZodError) {
      return workerJson(
        {
          code: "VALIDATION_ERROR",
          message: "Check the highlighted fields and try again.",
          fieldErrors: z.flattenError(error).fieldErrors,
        },
        400,
      );
    }
    if (error instanceof WorkerServiceError) {
      if (error.status === 401 || error.status === 403) {
        return workerError(
          503,
          "WORKER_SERVICE_UNAVAILABLE",
          "Worker Service is unavailable.",
        );
      }
      return workerJson(
        {
          code: error.code,
          message: error.message,
          correlationId: error.correlationId,
        },
        error.status,
      );
    }
    return workerError(
      500,
      "INTERNAL_SERVER_ERROR",
      "Could not complete the Worker Service request.",
    );
  }
}

export function withWorkerMutation(
  request: NextRequest,
  operation: (input: unknown) => Promise<Response>,
) {
  return withWorkerSession(
    async () => {
      if (!isSamePortalOrigin(request)) {
        return workerError(
          403,
          "FORBIDDEN",
          "Change worker records from the SiteGate portal.",
        );
      }
      if (!isJsonRequest(request)) {
        return workerError(
          415,
          "UNSUPPORTED_MEDIA_TYPE",
          "Send worker data as JSON.",
        );
      }
      let input: unknown;
      try {
        input = await request.json();
      } catch {
        return workerError(400, "INVALID_JSON", "Enter valid worker data.");
      }
      return operation(input);
    },
    { adminOnly: true },
  );
}
