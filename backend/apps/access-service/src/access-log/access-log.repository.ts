import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AccessLog, AccessLogDocument } from './schemas/access-log.schema';

@Injectable()
export class AccessLogRepository {
  constructor(
    @InjectModel(AccessLog.name)
    private readonly model: Model<AccessLogDocument>,
  ) {}

  record(entry: Partial<AccessLog>) {
    return this.model.create(entry);
  }
}