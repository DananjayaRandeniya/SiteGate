import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { DeactivationReason, RevokeReason, WorkerStatus } from '@app/contracts';
import { Schema as MongooseSchema, Types } from 'mongoose';
import { Contractor } from '../../contractors/schemas/contractor.schema';

@Schema({ _id: false })
class WorkerCredential {
  @Prop({ required: true, trim: true })
  number!: string;

  @Prop({ default: Date.now })
  issuedAt!: Date;

  @Prop({ type: Date, default: null })
  revokedAt!: Date | null;

  @Prop({ type: String, enum: Object.values(RevokeReason) })
  revokeReason?: RevokeReason;

  @Prop({ type: String })
  revokeNote?: string;
}

const WorkerCredentialSchema = SchemaFactory.createForClass(WorkerCredential);

@Schema({ timestamps: true })
export class Worker {
  @Prop({ required: true, trim: true })
  fullName!: string;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: Contractor.name,
    required: true,
  })
  contractorId!: Types.ObjectId;

  @Prop({ required: true })
  inductionDate!: Date;

  @Prop({ required: true })
  safetyTicketExpiry!: Date;

  @Prop({ type: [String], default: [] })
  assignedSiteIds!: string[];

  @Prop({
    type: String,
    enum: Object.values(WorkerStatus),
    default: WorkerStatus.ACTIVE,
    required: true,
  })
  status!: WorkerStatus;

  @Prop({ type: String, enum: Object.values(DeactivationReason) })
  deactivationReason?: DeactivationReason;

  @Prop({ type: String })
  deactivationNote?: string;

  @Prop({ type: Date, default: null })
  deletedAt!: Date | null;

  @Prop({ type: [WorkerCredentialSchema], default: [], required: true })
  credentials!: WorkerCredential[];
}

export const WorkerSchema = SchemaFactory.createForClass(Worker);

// MongoDB enforces uniqueness between workers. Validate each worker's own history too.
WorkerSchema.path('credentials').validate((credentials: WorkerCredential[]) => {
  const numbers = new Set(credentials.map((credential) => credential.number));
  const active = credentials.filter(
    (credential) => credential.revokedAt === null,
  );
  return numbers.size === credentials.length && active.length <= 1;
}, 'Credential numbers must be distinct and only one credential may be active');

WorkerSchema.index({ 'credentials.number': 1 }, { unique: true, sparse: true });
WorkerSchema.index({ deletedAt: 1, createdAt: -1, _id: -1 });
WorkerSchema.index({ deletedAt: 1, contractorId: 1 });
WorkerSchema.index({ deletedAt: 1, assignedSiteIds: 1 });
WorkerSchema.index({ deletedAt: 1, status: 1 });
