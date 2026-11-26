import type { DenialReason } from '@app/contracts';
import type { WorkerSnapshot } from '../../worker-snapshots/schemas/worker-snapshot.schema';

export interface AccessContext {
  snapshot: WorkerSnapshot | null; // null when the credential is unknown
  siteId: string;
  now: Date;
}

export interface AccessRule {
  // Returns a denial reason if this rule fails, or null if it passes
  check(ctx: AccessContext): DenialReason | null;
}