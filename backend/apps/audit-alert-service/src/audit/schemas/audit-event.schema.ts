import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema({ collection: 'audit_events', timestamps: true })
export class AuditEvent {
  // From the event envelope
  @Prop({ type: String, required: true }) eventId!: string;
  @Prop({ type: String, required: true }) eventType!: string;
  @Prop({ type: Number, required: true }) version!: number;
  @Prop({ type: Date, required: true }) occurredAt!: Date;
  @Prop({ type: String, required: true }) source!: string;
  @Prop({ type: String, required: true }) correlationId!: string;
  @Prop({ type: Object, required: true }) payload!: Record<string, unknown>;

  // Copied out of the payload so we can search by them later
  @Prop({ type: String }) workerId?: string;
  @Prop({ type: String }) credentialNumber?: string;

  // Where the event came from in Kafka
  @Prop({ type: String, required: true }) topic!: string;
  @Prop({ type: Number, required: true }) partition!: number;
  @Prop({ type: String, required: true }) offset!: string;
}

export const AuditEventSchema = SchemaFactory.createForClass(AuditEvent);

// The duplicate check: MongoDB refuses a second record with the same eventId.
AuditEventSchema.index({ eventId: 1 }, { unique: true });