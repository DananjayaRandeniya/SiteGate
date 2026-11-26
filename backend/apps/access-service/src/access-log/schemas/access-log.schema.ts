import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { AccessResult, DenialReason, Direction } from '@app/contracts';

export type AccessLogDocument = HydratedDocument<AccessLog>;

@Schema({ collection: 'access_log', timestamps: true })
export class AccessLog {
  @Prop({ type: String, required: true })
  credentialNumber: string;

  @Prop({ type: String })
  workerId?: string; // missing when the credential is unknown

  @Prop({ type: String, required: true })
  siteId: string;

  @Prop({ type: String, required: true })
  gateId: string;

  @Prop({ type: String, enum: Object.values(Direction), required: true })
  direction: Direction;

  @Prop({ type: String, enum: Object.values(AccessResult), required: true })
  result: AccessResult;

  @Prop({ type: String, enum: Object.values(DenialReason) })
  reasonCode?: DenialReason; // only when denied
}

export const AccessLogSchema = SchemaFactory.createForClass(AccessLog);

// Indexes for the queries we will run (the brief requires an index for each)
AccessLogSchema.index({ credentialNumber: 1, createdAt: -1 });
AccessLogSchema.index({ siteId: 1, workerId: 1, createdAt: -1 });