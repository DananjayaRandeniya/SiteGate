import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  ProcessedEvent,
  ProcessedEventSchema,
} from './schemas/processed-event.schema';
import { ProcessedEventsRepository } from './processed-events.repository';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ProcessedEvent.name, schema: ProcessedEventSchema },
    ]),
  ],
  providers: [ProcessedEventsRepository],
  exports: [ProcessedEventsRepository],
})
export class ProcessedEventsModule {}