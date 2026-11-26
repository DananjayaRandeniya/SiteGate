import type { NextRequest } from "next/server";
import { withWorkerMutation, workerJson } from "@/lib/workers/worker-route";
import { changeWorkerSite } from "@/lib/workers/worker-service";

export function POST(
  request: NextRequest,
  context: RouteContext<"/api/workers/[id]/sites">,
) {
  return withWorkerMutation(request, async (input) => {
    const { id } = await context.params;
    return workerJson(await changeWorkerSite(id, "POST", input));
  });
}

export function DELETE(
  request: NextRequest,
  context: RouteContext<"/api/workers/[id]/sites">,
) {
  return withWorkerMutation(request, async (input) => {
    const { id } = await context.params;
    return workerJson(await changeWorkerSite(id, "DELETE", input));
  });
}
