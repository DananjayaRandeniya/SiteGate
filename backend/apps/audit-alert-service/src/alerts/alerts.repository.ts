import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { Alert } from './schemas/alert.schema';

/** An alert as saved in MongoDB, with its ID as a plain string. */
export type StoredAlert = Alert & { id: string };

const isDuplicateKeyError = (err: unknown): boolean =>
  typeof err === 'object' &&
  err !== null &&
  'code' in err &&
  (err as { code: unknown }).code === 11000;

@Injectable()
export class AlertsRepository {
  constructor(@InjectModel(Alert.name) private readonly model: Model<Alert>) {}

  /** Saves the alert. Returns null if an Open alert for this credential and type already exists. */
    /** Saves the alert. Returns null if an Open alert for this credential and type already exists. */
  async insertIfNoOpen(doc: Partial<Alert>): Promise<StoredAlert | null> {
    try {
      const created = await this.model.create(doc);
      return { ...created.toObject(), id: created._id.toString() };
    } catch (err) {
      if (isDuplicateKeyError(err)) {
        return null;
      }
      throw err;
    }
  }
}