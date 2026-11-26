import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AccessLog, AccessLogDocument } from './schemas/access-log.schema';
import { AccessResult, Direction } from '@app/contracts';

@Injectable()
export class AccessLogRepository {
  constructor(
    @InjectModel(AccessLog.name)
    private readonly model: Model<AccessLogDocument>,
  ) {}

  record(entry: Partial<AccessLog>) {
    return this.model.create(entry);
  }

  async findOnSite(siteId: string): Promise<{ workerId: string; enteredAt: Date }[]> {
    const rows = await this.model.aggregate<{ _id: string; lastAt: Date }>([
      { $match: { siteId, result: AccessResult.GRANTED, workerId: { $exists: true } } },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: '$workerId',
          lastDirection: { $first: '$direction' },
          lastAt: { $first: '$createdAt' },
        },
      },
      { $match: { lastDirection: Direction.ENTRY } },
    ]);
    return rows.map((r) => ({ workerId: r._id, enteredAt: r.lastAt }));
  }
}