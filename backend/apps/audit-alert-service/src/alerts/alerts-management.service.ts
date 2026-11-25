import { Injectable } from '@nestjs/common';
import { AlertStatus } from '@app/contracts';
import { AlertsRepository } from './alerts.repository';
import type { AlertFilter, AlertView } from './alerts.repository';
import type { ListAlertsQueryDto } from './dto/list-alerts-query.dto';
import { AlertNotFoundError, InvalidAlertTransitionError } from './errors';

// Which status can follow which. Resolved is final.
const ALLOWED_TRANSITIONS: Record<string, readonly string[]> = {
  [AlertStatus.OPEN]: [AlertStatus.ACKNOWLEDGED, AlertStatus.RESOLVED],
  [AlertStatus.ACKNOWLEDGED]: [AlertStatus.RESOLVED],
  [AlertStatus.RESOLVED]: [],
};

@Injectable()
export class AlertsManagementService {
  constructor(private readonly repository: AlertsRepository) {}

  async list(query: ListAlertsQueryDto) {
    const { page, pageSize } = query;

    // Only add filters the caller really sent. An undefined value would match "null" in MongoDB.
    const filter: AlertFilter = {};
    if (query.status) filter.status = query.status;
    if (query.type) filter.type = query.type;
    if (query.severity) filter.severity = query.severity;
    if (query.workerId) filter.workerId = query.workerId;
    if (query.siteId) filter.siteId = query.siteId;
    if (query.credentialNumber) filter.credentialNumber = query.credentialNumber;

    const { items, total } = await this.repository.findPage(
      filter,
      (page - 1) * pageSize,
      pageSize,
    );
    return { data: items, page, pageSize, total };
  }

  async get(id: string): Promise<AlertView> {
    const alert = await this.repository.findById(id);
    if (!alert) {
      throw new AlertNotFoundError(id);
    }
    return alert;
  }

  async changeStatus(id: string, next: string): Promise<AlertView> {
    const current = await this.get(id);

    if (!ALLOWED_TRANSITIONS[current.status]?.includes(next)) {
      throw new InvalidAlertTransitionError(current.status, next);
    }

    const updated = await this.repository.changeStatus(id, current.status, next);
    if (!updated) {
      // Someone changed the alert between our read and our update
      throw new InvalidAlertTransitionError(current.status, next);
    }
    return updated;
  }
}