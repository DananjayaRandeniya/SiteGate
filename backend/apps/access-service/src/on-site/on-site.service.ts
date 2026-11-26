import { Injectable } from '@nestjs/common';
import { AccessLogRepository } from '../access-log/access-log.repository';
import { WorkerSnapshotsRepository } from '../worker-snapshots/worker-snapshots.repository';

@Injectable()
export class OnSiteService {
  constructor(
    private readonly accessLog: AccessLogRepository,
    private readonly snapshots: WorkerSnapshotsRepository,
  ) {}

  async list(siteId: string) {
    const present = await this.accessLog.findOnSite(siteId);
    if (present.length === 0) return [];

    const snapshots = await this.snapshots.findByWorkerIds(present.map((p) => p.workerId));
    const byId = new Map(snapshots.map((s) => [s.workerId, s]));

    return present.map((p) => ({
      workerId: p.workerId,
      name: byId.get(p.workerId)?.name,
      contractorId: byId.get(p.workerId)?.contractorId,
      enteredAt: p.enteredAt,
    }));
  }
}