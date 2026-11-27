import { withWorkerSession, workerJson } from "@/lib/workers/worker-route";
import { getContractors } from "@/lib/workers/worker-service";

export function GET() {
  return withWorkerSession(async () => workerJson(await getContractors()));
}
