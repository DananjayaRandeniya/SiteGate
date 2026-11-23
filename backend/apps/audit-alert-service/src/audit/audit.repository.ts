import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { AuditEvent } from './schemas/audit-event.schema';

// MongoDB error code 11000 means "this would break a unique index"
const isDuplicateKeyError = (err: unknown): boolean =>
  typeof err === 'object' &&
  err !== null &&
  'code' in err &&
  (err as { code: unknown }).code === 11000;

@Injectable()
export class AuditRepository {
  constructor(
    @InjectModel(AuditEvent.name) private readonly model: Model<AuditEvent>,
  ) {}

  /** Saves the event. Returns false if this eventId was already saved. */
  async insertIfNew(doc: Partial<AuditEvent>): Promise<boolean> {
    try {
      await this.model.create(doc);
      return true;
    } catch (err) {
      if (isDuplicateKeyError(err)) {
        return false;
      }
      throw err; // a real problem, so don't hide it
    }
  }
    async findByWorker(
    workerId: string,
    skip: number,
    limit: number,
  ): Promise<{ items: AuditEvent[]; total: number }> {
    const filter = { workerId };
    const [items, total] = await Promise.all([
      this.model
        .find(filter)
        .sort({ occurredAt: -1, _id: -1 }) // newest first; _id breaks ties
        .skip(skip)
        .limit(limit)
        .select('-__v')
        .lean<AuditEvent[]>()
        .exec(),
      this.model.countDocuments(filter).exec(),
    ]);
    return { items, total };
  }
}