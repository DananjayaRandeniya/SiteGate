import { type DeactivationReason, WorkerStatus } from '@app/contracts';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { type Model, mongo, type QueryFilter, Types } from 'mongoose';
import { DomainError } from '../common/domain-error';
import type { CreateWorkerDto } from './dto/create-worker.dto';
import type { ListWorkersQueryDto } from './dto/list-workers-query.dto';
import type { RevokeCredentialDto } from './dto/worker-credential.dto';
import { Worker } from './schemas/worker.schema';

export type WorkerProfileChanges = Partial<
  Pick<
    Worker,
    'fullName' | 'contractorId' | 'inductionDate' | 'safetyTicketExpiry'
  >
>;

@Injectable()
export class WorkersRepository {
  constructor(
    @InjectModel(Worker.name) private readonly workers: Model<Worker>,
  ) {}

  existsVisible(id: string) {
    return this.workers.exists({ _id: id, deletedAt: null }).exec();
  }

  async deactivate(id: string, reason: DeactivationReason, note?: string) {
    const result = await this.workers
      .updateOne(
        { _id: id, deletedAt: null, status: WorkerStatus.ACTIVE },
        {
          $set: {
            status: WorkerStatus.INACTIVE,
            deactivationReason: reason,
            ...(note === undefined ? {} : { deactivationNote: note }),
          },
        },
        { runValidators: true },
      )
      .exec();
    return result.modifiedCount === 1;
  }

  archive(id: string) {
    // The previous status tells us whether this archive also made the worker inactive.
    return this.workers
      .findOneAndUpdate(
        { _id: id, deletedAt: null },
        { $set: { deletedAt: new Date(), status: WorkerStatus.INACTIVE } },
        { returnDocument: 'before', runValidators: true },
      )
      .exec();
  }

  async issueCredential(id: string, credentialNumber: string, issuedAt: Date) {
    try {
      const result = await this.workers
        .updateOne(
          {
            _id: id,
            deletedAt: null,
            credentials: { $not: { $elemMatch: { revokedAt: null } } },
            'credentials.number': { $ne: credentialNumber },
          },
          {
            $push: {
              credentials: {
                number: credentialNumber,
                issuedAt,
                revokedAt: null,
              },
            },
          },
          { runValidators: true },
        )
        .exec();
      return result.modifiedCount === 1;
    } catch (error) {
      return this.throwCredentialWriteError(error);
    }
  }

  async revokeCredential(
    id: string,
    { credentialNumber, reason, note }: RevokeCredentialDto,
    revokedAt: Date,
  ) {
    const result = await this.workers
      .updateOne(
        {
          _id: id,
          deletedAt: null,
          credentials: {
            $elemMatch: { number: credentialNumber, revokedAt: null },
          },
        },
        {
          $set: {
            'credentials.$.revokedAt': revokedAt,
            'credentials.$.revokeReason': reason,
            ...(note === undefined ? {} : { 'credentials.$.revokeNote': note }),
          },
        },
        { runValidators: true },
      )
      .exec();
    return result.modifiedCount === 1;
  }

  private throwCredentialWriteError(error: unknown): never {
    if (
      error instanceof mongo.MongoServerError &&
      error.code === 11000 &&
      Object.hasOwn(error.keyPattern ?? {}, 'credentials.number')
    ) {
      throw new DomainError(
        'CREDENTIAL_IN_USE',
        'This credential is already in use',
      );
    }
    throw error;
  }

  async create(input: CreateWorkerDto) {
    try {
      return await this.workers.create({
        fullName: input.fullName,
        contractorId: new Types.ObjectId(input.contractorId),
        inductionDate: new Date(input.inductionDate),
        safetyTicketExpiry: new Date(input.safetyTicketExpiry),
        assignedSiteIds: [...new Set(input.assignedSiteIds)],
        credentials: [{ number: input.credentialNumber }],
      });
    } catch (error) {
      return this.throwCredentialWriteError(error);
    }
  }

  findVisibleById(id: string) {
    return this.workers.findOne({ _id: id, deletedAt: null }).exec();
  }

  async listVisible(query: ListWorkersQueryDto) {
    const filter: QueryFilter<Worker> = { deletedAt: null };
    if (query.status !== undefined) filter.status = query.status;
    if (query.contractorId !== undefined)
      filter.contractorId = new Types.ObjectId(query.contractorId);
    if (query.siteId !== undefined) filter.assignedSiteIds = query.siteId;
    if (query.search) {
      const escaped = query.search.replace(/[.*+?^$(){}|[\]\\]/g, '\\$&');
      const text = new RegExp(escaped, 'i');
      filter.$or = [
        { fullName: text },
        { credentials: { $elemMatch: { number: text, revokedAt: null } } },
      ];
    }

    const [workers, total] = await Promise.all([
      this.workers
        .find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .exec(),
      this.workers.countDocuments(filter).exec(),
    ]);
    return { workers, total };
  }

  updateVisibleProfile(id: string, changes: WorkerProfileChanges) {
    const changedFields = Object.entries(changes).map(([field, value]) => ({
      [field]: { $ne: value },
    }));

    // Return the profile at the time of the update so the event describes this write.
    return this.workers
      .findOneAndUpdate(
        { _id: id, deletedAt: null, $or: changedFields },
        { $set: changes },
        { returnDocument: 'before', runValidators: true },
      )
      .exec();
  }

  assignSite(id: string, siteId: string) {
    return this.workers
      .findOneAndUpdate(
        { _id: id, deletedAt: null, assignedSiteIds: { $ne: siteId } },
        { $addToSet: { assignedSiteIds: siteId } },
        { returnDocument: 'after' },
      )
      .exec();
  }

  unassignSite(id: string, siteId: string) {
    return this.workers
      .findOneAndUpdate(
        { _id: id, deletedAt: null, assignedSiteIds: siteId },
        { $pull: { assignedSiteIds: siteId } },
        { returnDocument: 'after' },
      )
      .exec();
  }
}
