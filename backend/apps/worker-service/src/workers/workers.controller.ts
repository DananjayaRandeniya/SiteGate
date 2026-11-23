import { Body, Controller, Post, Res, UseGuards } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Response } from 'express';
import { CORRELATION_ID_HEADER } from '../common/request-logging.middleware';
import { CreateWorkerDto } from './dto/create-worker.dto';
import { WorkerAdminGuard } from './worker-admin.guard';
import { WorkersService } from './workers.service';

@Controller('workers')
export class WorkersController {
  constructor(private readonly workers: WorkersService) {}

  @Post()
  @UseGuards(WorkerAdminGuard)
  register(
    @Body() input: CreateWorkerDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const correlationId = response.get(CORRELATION_ID_HEADER) ?? randomUUID();
    response.set(CORRELATION_ID_HEADER, correlationId);
    return this.workers.register(input, correlationId);
  }
}
