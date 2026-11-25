import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  ProcessedEvent,
  ProcessedEventDocument,
} from './schemas/processed-event.schema';

@Injectable()
export class ProcessedEventsRepository {
  constructor(
    @InjectModel(ProcessedEvent.name)
    private readonly model: Model<ProcessedEventDocument>,
  ) {}

  async exists(eventId: string): Promise<boolean> {
    return (await this.model.exists({ eventId })) !== null;
  }

  async markProcessed(eventId: string, eventType: string): Promise<void> {
    try {
      await this.model.create({ eventId, eventType });
    } catch (err) {
      // 11000 = duplicate key: already recorded, which is fine
      if ((err as { code?: number }).code !== 11000) throw err;
    }
  }
}