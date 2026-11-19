import { Module } from '@nestjs/common';
import { AccessServiceController } from './access-service.controller';
import { AccessServiceService } from './access-service.service';

@Module({
  imports: [],
  controllers: [AccessServiceController],
  providers: [AccessServiceService],
})
export class AccessServiceModule {}
