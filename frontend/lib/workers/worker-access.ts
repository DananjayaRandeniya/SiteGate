import "server-only";

type WorkerPortalRole = "Admin" | "Manager";

export async function getWorkerPortalRole(): Promise<WorkerPortalRole | null> {
  // Worker routes stay closed until the shared session can supply a verified role.
  return null;
}
