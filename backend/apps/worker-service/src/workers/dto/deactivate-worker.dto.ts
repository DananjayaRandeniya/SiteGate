import { DeactivationReason } from '@app/contracts';
import { Transform } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsString, ValidateIf } from 'class-validator';

export class DeactivateWorkerDto {
  @ValidateIf((_body: object, value: unknown) => value !== undefined)
  @IsEnum(DeactivationReason)
  reason?: DeactivationReason;

  @ValidateIf((_body: object, value: unknown) => value !== undefined)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  note?: string;
}
