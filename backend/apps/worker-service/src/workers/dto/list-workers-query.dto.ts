import { WorkerStatus } from '@app/contracts';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const MAX_PAGE_SIZE = 100;

function queryInteger({ value }: { value: unknown }) {
  return typeof value === 'string' && /^\d+$/.test(value)
    ? Number(value)
    : value;
}

function trimQueryText({ value }: { value: unknown }) {
  return typeof value === 'string' ? value.trim() : value;
}

export class ListWorkersQueryDto {
  @Transform(queryInteger)
  @IsInt()
  @Min(1)
  @Max(Math.floor(Number.MAX_SAFE_INTEGER / MAX_PAGE_SIZE))
  page = 1;

  @Transform(queryInteger)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  limit = 20;

  @IsOptional()
  @Transform(trimQueryText)
  @IsString()
  @MaxLength(120)
  search?: string;

  @IsOptional()
  @IsEnum(WorkerStatus)
  status?: WorkerStatus;

  @IsOptional()
  @IsMongoId()
  contractorId?: string;

  @IsOptional()
  @Transform(trimQueryText)
  @IsString()
  @IsNotEmpty()
  siteId?: string;
}
