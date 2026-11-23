import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { WorkerStatus } from '@app/contracts';

export type WorkerSnapshotDocument = HydratedDocument<WorkerSnapshot>;

@Schema({ collection: 'worker_snapshots', timestamps: true })
export class WorkerSnapshot {
  @Prop({ type: String, required: true, unique: true })
  workerId: string;

  @Prop({ type: String })
  name: string;

  @Prop({ type: String })
  contractorId: string;

  @Prop({ type: [String], default: [] })
  siteIds: string[];

  @Prop({ type: Date })
  inductionDate: Date;

  @Prop({ type: Date })
  ticketExpiry: Date;

  @Prop({
    type: String,
    enum: Object.values(WorkerStatus),
    default: WorkerStatus.ACTIVE,
  })
  status: WorkerStatus;

  @Prop({ type: String, index: true, sparse: true })
  credentialNumber?: string;

  @Prop({ type: Boolean, default: false })
  credentialRevoked: boolean;
}

export const WorkerSnapshotSchema =
  SchemaFactory.createForClass(WorkerSnapshot);