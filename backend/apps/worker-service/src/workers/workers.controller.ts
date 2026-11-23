import { WorkerStatus } from '@app/contracts';
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
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiExtraModels,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiServiceUnavailableResponse,
  ApiUnauthorizedResponse,
  getSchemaPath,
} from '@nestjs/swagger';
import { randomUUID } from 'node:crypto';
import type { Response } from 'express';
import { CORRELATION_ID_HEADER } from '../common/request-logging.middleware';
import {
  DeactivatedWorkerResponse,
  RegisteredWorkerResponse,
  deactivationExample,
  registrationExample,
  workerApiError,
  workerIdExample,
} from '../openapi/worker-api-docs';
import { CreateWorkerDto } from './dto/create-worker.dto';
import { DeactivateWorkerDto } from './dto/deactivate-worker.dto';
import { ListWorkersQueryDto } from './dto/list-workers-query.dto';
import { UpdateWorkerDto, WorkerIdParams } from './dto/update-worker.dto';
import { WorkerSiteDto } from './dto/worker-site.dto';
import { WorkerAdminGuard } from './worker-admin.guard';
import { WorkersService } from './workers.service';

const adminRequired = workerApiError(
  HttpStatus.UNAUTHORIZED,
  'UNAUTHORIZED',
  'Site Admin authorization required',
);

@ApiExtraModels(CreateWorkerDto, DeactivateWorkerDto)
@Controller('workers')
export class WorkersController {
  constructor(private readonly workers: WorkersService) {}

  @Post()
  @ApiOperation({ summary: 'Register an active worker' })
  @ApiBearerAuth()
  @ApiBody({
    schema: { $ref: getSchemaPath(CreateWorkerDto) },
    examples: {
      registration: {
        summary: 'Worker assigned to S-01',
        value: registrationExample,
      },
    },
  })
  @ApiCreatedResponse({
    description: 'Worker saved and registration events confirmed',
    type: RegisteredWorkerResponse,
    example: {
      ...registrationExample,
      id: workerIdExample,
      status: WorkerStatus.ACTIVE,
    },
  })
  @ApiBadRequestResponse(
    workerApiError(
      HttpStatus.BAD_REQUEST,
      'BAD_REQUEST',
      'fullName should not be empty',
    ),
  )
  @ApiUnauthorizedResponse(adminRequired)
  @ApiNotFoundResponse(
    workerApiError(
      HttpStatus.NOT_FOUND,
      'CONTRACTOR_NOT_FOUND',
      'Contractor was not found',
    ),
  )
  @ApiConflictResponse(
    workerApiError(
      HttpStatus.CONFLICT,
      'CREDENTIAL_IN_USE',
      'This credential is already in use',
    ),
  )
  @ApiServiceUnavailableResponse(
    workerApiError(
      HttpStatus.SERVICE_UNAVAILABLE,
      'REGISTRATION_EVENT_UNCONFIRMED',
      'Worker was saved, but its registration events could not be confirmed',
    ),
  )
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
  @ApiOperation({ summary: 'Deactivate a worker' })
  @ApiBearerAuth()
  @ApiParam({ name: 'id', example: workerIdExample })
  @ApiBody({
    required: false,
    schema: { $ref: getSchemaPath(DeactivateWorkerDto) },
    examples: {
      contractEnded: { summary: 'Contract ended', value: deactivationExample },
    },
  })
  @ApiOkResponse({
    description: 'Worker is inactive',
    type: DeactivatedWorkerResponse,
    example: { id: workerIdExample, status: WorkerStatus.INACTIVE },
  })
  @ApiBadRequestResponse(
    workerApiError(
      HttpStatus.BAD_REQUEST,
      'BAD_REQUEST',
      'id must be a mongodb id',
    ),
  )
  @ApiUnauthorizedResponse(adminRequired)
  @ApiNotFoundResponse(
    workerApiError(
      HttpStatus.NOT_FOUND,
      'WORKER_NOT_FOUND',
      'Worker was not found',
    ),
  )
  @ApiServiceUnavailableResponse(
    workerApiError(
      HttpStatus.SERVICE_UNAVAILABLE,
      'WORKER_DEACTIVATION_EVENT_UNCONFIRMED',
      'Worker was made inactive, but the deactivation event could not be confirmed',
    ),
  )
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
  @ApiBearerAuth()
  @UseGuards(WorkerAdminGuard)
  archive(
    @Param() { id }: WorkerIdParams,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.workers.archive(id, responseCorrelationId(response));
  }

  @Patch(':id')
  @ApiBearerAuth()
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
  @ApiBearerAuth()
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
  @ApiBearerAuth()
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
