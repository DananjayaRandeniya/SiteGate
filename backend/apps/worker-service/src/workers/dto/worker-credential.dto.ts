import { RevokeReason } from '@app/contracts';
import { PickType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsMongoId,
  IsNotEmpty,
  IsString,
  ValidateIf,
} from 'class-validator';
import { CreateWorkerDto } from './create-worker.dto';

export class WorkerCredentialParams {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.toLowerCase() : value,
  )
  @IsMongoId()
  id!: string;
}

export class IssueCredentialDto extends PickType(CreateWorkerDto, [
  'credentialNumber',
] as const) {}

export class RevokeCredentialDto extends IssueCredentialDto {
  @IsEnum(RevokeReason)
  reason!: RevokeReason;

  @ValidateIf((_body: object, value: unknown) => value !== undefined)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  note?: string;
}
