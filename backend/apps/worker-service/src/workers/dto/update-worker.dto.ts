import { PartialType, PickType } from '@nestjs/swagger';
import { IsMongoId } from 'class-validator';
import { CreateWorkerDto } from './create-worker.dto';

export class WorkerIdParams {
  @IsMongoId()
  id!: string;
}

export class UpdateWorkerDto extends PartialType(
  PickType(CreateWorkerDto, [
    'fullName',
    'contractorId',
    'inductionDate',
    'safetyTicketExpiry',
  ] as const),
  { skipNullProperties: false },
) {}
