import type { NextRequest } from "next/server";
import { withWorkerMutation, workerJson } from "@/lib/workers/worker-route";
import { issueCredential } from "@/lib/workers/worker-service";

export function POST(
  request: NextRequest,
  context: RouteContext<"/api/workers/[id]/credentials">,
) {
  return withWorkerMutation(request, async (input) => {
    const { id } = await context.params;
    return workerJson(await issueCredential(id, input), 201);
  });
}
