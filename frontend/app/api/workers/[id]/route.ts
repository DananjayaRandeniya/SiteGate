import type { NextRequest } from "next/server";
import {
  withWorkerMutation,
  withWorkerSession,
  workerJson,
} from "@/lib/workers/worker-route";
import {
  archiveWorker,
  getWorkerProfile,
  updateWorker,
} from "@/lib/workers/worker-service";

export function GET(
  _request: Request,
  context: RouteContext<"/api/workers/[id]">,
) {
  return withWorkerSession(async () => {
    const { id } = await context.params;
    return workerJson(await getWorkerProfile(id));
  });
}

export function PATCH(
  request: NextRequest,
  context: RouteContext<"/api/workers/[id]">,
) {
  return withWorkerMutation(request, async (input) => {
    const { id } = await context.params;
    return workerJson(await updateWorker(id, input));
  });
}

export function DELETE(
  request: NextRequest,
  context: RouteContext<"/api/workers/[id]">,
) {
  return withWorkerMutation(request, async (input) => {
    const { id } = await context.params;
    await archiveWorker(id, input);
    return new Response(null, {
      status: 204,
      headers: { "Cache-Control": "private, no-store" },
    });
  });
}
