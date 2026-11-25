import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { AlertSeverity, AlertStatus, AlertType } from '@app/contracts';

@Schema({ collection: 'alerts', timestamps: true })
export class Alert {
  @Prop({ type: String, enum: Object.values(AlertType), required: true })
  type!: string;

  @Prop({ type: String, enum: Object.values(AlertSeverity), required: true })
  severity!: string;

  @Prop({
    type: String,
    enum: Object.values(AlertStatus),
    default: AlertStatus.OPEN,
    required: true,
  })
  status!: string;

  @Prop({ type: String, required: true }) credentialNumber!: string;
  @Prop({ type: String }) workerId?: string; // missing when the credential is unknown
  @Prop({ type: String, required: true }) siteId!: string;
  @Prop({ type: String }) gateId?: string;

  // Which event caused the alert, for tracing
  @Prop({ type: String, required: true }) triggerEventId!: string;
  @Prop({ type: String, required: true }) correlationId!: string;
}

export const AlertSchema = SchemaFactory.createForClass(Alert);

// At most ONE open alert per credential and rule. A 4th denial cannot add a duplicate.
AlertSchema.index(
  { type: 1, credentialNumber: 1 },
  { unique: true, partialFilterExpression: { status: AlertStatus.OPEN } },
);
// GET /alerts without filters, or filtered by type, severity, site or credential: newest first
AlertSchema.index({ createdAt: -1, _id: -1 });
// GET /alerts?status=...: the most common filter
AlertSchema.index({ status: 1, createdAt: -1, _id: -1 });
// GET /alerts?workerId=...: alerts of one worker
AlertSchema.index({ workerId: 1, createdAt: -1, _id: -1 });