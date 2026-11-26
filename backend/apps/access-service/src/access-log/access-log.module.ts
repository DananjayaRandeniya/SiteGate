import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AccessLogRepository } from './access-log.repository';
import { AccessLog, AccessLogSchema } from './schemas/access-log.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: AccessLog.name, schema: AccessLogSchema }]),
  ],
  providers: [AccessLogRepository],
  exports: [AccessLogRepository],
})
export class AccessLogModule {}