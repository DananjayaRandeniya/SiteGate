import { Transform } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsMongoId,
  IsNotEmpty,
  IsString,
  Matches,
  Validate,
  ValidateIf,
} from 'class-validator';
import { NotFutureSiteDate } from './not-future-site-date.validator';

const dateOnlyPattern = /^\d{4}-\d{2}-\d{2}$/;

function trimText(value: unknown) {
  return typeof value === 'string' ? value.trim() : value;
}

export class CreateWorkerDto {
  @Transform(({ value }: { value: unknown }) => trimText(value))
  @IsString()
  @IsNotEmpty()
  fullName!: string;

  @IsMongoId()
  contractorId!: string;

  @Transform(({ value }: { value: unknown }) => trimText(value))
  @IsString()
  @IsNotEmpty()
  credentialNumber!: string;

  @Matches(dateOnlyPattern, { message: '$property must use YYYY-MM-DD' })
  @IsDateString({ strict: true })
  @Validate(NotFutureSiteDate)
  inductionDate!: string;

  @Matches(dateOnlyPattern, { message: '$property must use YYYY-MM-DD' })
  @IsDateString({ strict: true })
  safetyTicketExpiry!: string;

  @ValidateIf((_body: object, value: unknown) => value !== undefined)
  @Transform(({ value }: { value: unknown }) =>
    Array.isArray(value) ? value.map(trimText) : value,
  )
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  assignedSiteIds?: string[];
}
