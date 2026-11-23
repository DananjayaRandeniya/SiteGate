import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Response } from 'express';
import { CORRELATION_ID_HEADER } from '../common/request-logging.middleware';
import { CreateWorkerDto } from './dto/create-worker.dto';
import { DeactivateWorkerDto } from './dto/deactivate-worker.dto';
import { ListWorkersQueryDto } from './dto/list-workers-query.dto';
import { UpdateWorkerDto, WorkerIdParams } from './dto/update-worker.dto';
import { WorkerSiteDto } from './dto/worker-site.dto';
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
    return this.workers.register(input, responseCorrelationId(response));
  }

  @Get()
  list(@Query() query: ListWorkersQueryDto) {
    return this.workers.list(query);
  }

  @Get(':id')
  get(@Param() { id }: WorkerIdParams) {
    return this.workers.get(id);
  }

  @Patch(':id/deactivate')
  @UseGuards(WorkerAdminGuard)
  deactivate(
    @Param() { id }: WorkerIdParams,
    @Body() input: DeactivateWorkerDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.workers.deactivate(id, input, responseCorrelationId(response));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(WorkerAdminGuard)
  archive(
    @Param() { id }: WorkerIdParams,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.workers.archive(id, responseCorrelationId(response));
  }

  @Patch(':id')
  @UseGuards(WorkerAdminGuard)
  update(
    @Param() { id }: WorkerIdParams,
    @Body() input: UpdateWorkerDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.workers.update(id, input, responseCorrelationId(response));
  }

  @Post(':id/sites')
  @HttpCode(HttpStatus.OK)
  @UseGuards(WorkerAdminGuard)
  assignSite(
    @Param() { id }: WorkerIdParams,
    @Body() { siteId }: WorkerSiteDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.workers.changeSiteAssignment(
      id,
      siteId,
      'assign',
      responseCorrelationId(response),
    );
  }

  @Delete(':id/sites')
  @UseGuards(WorkerAdminGuard)
  unassignSite(
    @Param() { id }: WorkerIdParams,
    @Body() { siteId }: WorkerSiteDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.workers.changeSiteAssignment(
      id,
      siteId,
      'unassign',
      responseCorrelationId(response),
    );
  }
}

function responseCorrelationId(response: Response) {
  const correlationId = response.get(CORRELATION_ID_HEADER) ?? randomUUID();
  response.set(CORRELATION_ID_HEADER, correlationId);
  return correlationId;
}
