import type { NextRequest } from "next/server";
import {
  withWorkerMutation,
  withWorkerSession,
  workerJson,
} from "@/lib/workers/worker-route";
import {
  getWorkerDirectory,
  registerWorker,
} from "@/lib/workers/worker-service";

export function GET(request: NextRequest) {
  return withWorkerSession(async () =>
    workerJson(await getWorkerDirectory(request.nextUrl.searchParams)),
  );
}

export function POST(request: NextRequest) {
  return withWorkerMutation(request, async (input) => {
    const worker = await registerWorker(input);
    const response = workerJson(worker, 201);
    response.headers.set("Location", `/api/workers/${worker.id}`);
    return response;
  });
}
