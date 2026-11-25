import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ProcessedEventDocument = HydratedDocument<ProcessedEvent>;

@Schema({ collection: 'processed_events' })
export class ProcessedEvent {
  @Prop({ type: String, required: true, unique: true })
  eventId: string;

  @Prop({ type: String })
  eventType: string;

  // TTL index: MongoDB deletes the record after 7 days
  @Prop({ type: Date, default: Date.now, expires: 60 * 60 * 24 * 7 })
  processedAt: Date;
}

export const ProcessedEventSchema = SchemaFactory.createForClass(ProcessedEvent);