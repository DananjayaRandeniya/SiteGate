import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { WorkerSnapshot, WorkerSnapshotDocument } from './schemas/worker-snapshot.schema';

@Injectable()
export class WorkerSnapshotsRepository {
  constructor(
    @InjectModel(WorkerSnapshot.name)
    private readonly model: Model<WorkerSnapshotDocument>,
  ) {}

  findByWorkerId(workerId: string) {
    return this.model.findOne({ workerId }).exec();
  }

  findByCredentialNumber(credentialNumber: string) {
    return this.model.findOne({ credentialNumber }).exec();
  }

  // Create the snapshot if it doesn't exist, otherwise update it
  upsert(workerId: string, data: Partial<WorkerSnapshot>) {
    return this.model
      .findOneAndUpdate(
        { workerId },
        { $set: data },
        { upsert: true, new: true },
      )
      .exec();
  }
}