import type { NextRequest } from "next/server";
import { withWorkerMutation, workerJson } from "@/lib/workers/worker-route";
import { revokeCredential } from "@/lib/workers/worker-service";

export function POST(
  request: NextRequest,
  context: RouteContext<"/api/workers/[id]/credentials/revoke">,
) {
  return withWorkerMutation(request, async (input) => {
    const { id } = await context.params;
    return workerJson(await revokeCredential(id, input));
  });
}
