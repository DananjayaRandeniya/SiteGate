import type { NextRequest } from "next/server";
import { withWorkerMutation, workerJson } from "@/lib/workers/worker-route";
import { deactivateWorker } from "@/lib/workers/worker-service";

export function PATCH(
  request: NextRequest,
  context: RouteContext<"/api/workers/[id]/deactivate">,
) {
  return withWorkerMutation(request, async (input) => {
    const { id } = await context.params;
    return workerJson(await deactivateWorker(id, input));
  });
}
