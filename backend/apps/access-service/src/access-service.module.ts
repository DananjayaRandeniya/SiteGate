import { ConfigModule } from '@nestjs/config';
import * as Joi from 'joi';

import { Module } from '@nestjs/common';
import { AccessServiceController } from './access-service.controller';
import { AccessServiceService } from './access-service.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: 'apps/access-service/.env',
      validationSchema: Joi.object({
        PORT: Joi.number().required(),
      }),
    }),
  ],
  controllers: [AccessServiceController],
  providers: [AccessServiceService],
})
export class AccessServiceModule {}
