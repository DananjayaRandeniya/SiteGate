import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId } from 'mongoose';
import type { Model, Types } from 'mongoose';
import { Alert } from './schemas/alert.schema';

/** An alert right after saving. */
export type StoredAlert = Alert & { id: string };

/** An alert as the API returns it (id instead of _id). */
export interface AlertView extends Alert {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

/** The only fields GET /alerts can filter on. */
export type AlertFilter = Partial<
  Pick<Alert, 'status' | 'type' | 'severity' | 'workerId' | 'siteId' | 'credentialNumber'>
>;

type LeanAlert = Alert & { _id: Types.ObjectId; createdAt: Date; updatedAt: Date };

const toView = ({ _id, ...rest }: LeanAlert): AlertView => ({ ...rest, id: _id.toString() });

const isDuplicateKeyError = (err: unknown): boolean =>
  typeof err === 'object' &&
  err !== null &&
  'code' in err &&
  (err as { code: unknown }).code === 11000;

@Injectable()
export class AlertsRepository {
  constructor(@InjectModel(Alert.name) private readonly model: Model<Alert>) {}

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

  async findPage(
    filter: AlertFilter,
    skip: number,
    limit: number,
  ): Promise<{ items: AlertView[]; total: number }> {
    const [docs, total] = await Promise.all([
      this.model
        .find(filter)
        .sort({ createdAt: -1, _id: -1 }) // newest first; _id breaks ties
        .skip(skip)
        .limit(limit)
        .select('-__v')
        .lean<LeanAlert[]>()
        .exec(),
      this.model.countDocuments(filter).exec(),
    ]);
    return { items: docs.map(toView), total };
  }

  async findById(id: string): Promise<AlertView | null> {
    if (!isValidObjectId(id)) {
      return null;
    }
    const doc = await this.model.findById(id).select('-__v').lean<LeanAlert>().exec();
    return doc ? toView(doc) : null;
  }

  /** Changes the status only if the alert still has the status we read. Returns null if not. */
  async changeStatus(id: string, from: string, to: string): Promise<AlertView | null> {
    if (!isValidObjectId(id)) {
      return null;
    }
    const doc = await this.model
      .findOneAndUpdate({ _id: id, status: from }, { status: to }, { new: true })
      .select('-__v')
      .lean<LeanAlert>()
      .exec();
    return doc ? toView(doc) : null;
  }
}