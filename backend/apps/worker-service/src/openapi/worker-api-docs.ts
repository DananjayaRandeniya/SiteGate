import { DeactivationReason, WorkerStatus } from '@app/contracts';
import type { HttpStatus, INestApplication } from '@nestjs/common';
import { ApiProperty, DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { CreateWorkerDto } from '../workers/dto/create-worker.dto';
import type { DeactivateWorkerDto } from '../workers/dto/deactivate-worker.dto';

export const workerIdExample = '669f2a62d20bae6882af1871';
export const registrationExample = {
  fullName: 'Example Worker',
  contractorId: '669f2a62d20bae6882af1870',
  credentialNumber: 'C-1001',
  inductionDate: '2026-11-18',
  safetyTicketExpiry: '2027-02-28',
  assignedSiteIds: ['S-01'],
} satisfies Required<CreateWorkerDto>;

export const deactivationExample = {
  reason: DeactivationReason.CONTRACT_ENDED,
  note: 'Contract finished',
} satisfies DeactivateWorkerDto;

export class RegisteredWorkerResponse extends CreateWorkerDto {
  @ApiProperty({ example: workerIdExample })
  id!: string;

  @ApiProperty({ enum: [WorkerStatus.ACTIVE] })
  status!: typeof WorkerStatus.ACTIVE;

  @ApiProperty({ type: [String] })
  declare assignedSiteIds: string[];
}

export class DeactivatedWorkerResponse {
  @ApiProperty({ example: workerIdExample })
  id!: string;

  @ApiProperty({ enum: [WorkerStatus.INACTIVE] })
  status!: typeof WorkerStatus.INACTIVE;
}

class WorkerApiErrorResponse {
  @ApiProperty()
  statusCode!: number;

  @ApiProperty()
  code!: string;

  @ApiProperty()
  message!: string;

  @ApiProperty({ format: 'uuid' })
  correlationId!: string;

  @ApiProperty({ format: 'date-time' })
  timestamp!: string;
}

export function workerApiError(
  statusCode: HttpStatus,
  code: string,
  message: string,
) {
  return {
    description: message,
    type: WorkerApiErrorResponse,
    example: {
      statusCode,
      code,
      message,
      correlationId: 'd17f3a9a-efea-4ddd-959a-2ce8128871c5',
      timestamp: '2026-11-23T05:00:00.000Z',
    },
  };
}

export function setupWorkerApiDocs(app: INestApplication) {
  const config = new DocumentBuilder()
    .setTitle('SiteGate Worker Service')
    .setDescription('Manage worker and contractor records for SiteGate.')
    .setVersion('1.0')
    .addBearerAuth({
      type: 'http',
      scheme: 'bearer',
      description: 'Use the local WORKER_ADMIN_TOKEN for Site Admin actions.',
    })
    .build();

  SwaggerModule.setup('docs', app, () =>
    SwaggerModule.createDocument(app, config),
  );
}
