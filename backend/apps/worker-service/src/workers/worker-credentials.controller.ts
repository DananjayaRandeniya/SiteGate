import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { responseCorrelationId } from '../common/request-logging.middleware';
import {
  IssueCredentialDto,
  RevokeCredentialDto,
  WorkerCredentialParams,
} from './dto/worker-credential.dto';
import { WorkerAdminGuard } from './worker-admin.guard';
import { WorkerCredentialsService } from './worker-credentials.service';

@Controller('workers/:id/credentials')
@UseGuards(WorkerAdminGuard)
export class WorkerCredentialsController {
  constructor(private readonly credentials: WorkerCredentialsService) {}

  @Post()
  issue(
    @Param() { id }: WorkerCredentialParams,
    @Body() { credentialNumber }: IssueCredentialDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.credentials.issue(
      id,
      credentialNumber,
      responseCorrelationId(response),
    );
  }

  @Post('revoke')
  @HttpCode(HttpStatus.OK)
  revoke(
    @Param() { id }: WorkerCredentialParams,
    @Body() input: RevokeCredentialDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.credentials.revoke(id, input, responseCorrelationId(response));
  }
}
