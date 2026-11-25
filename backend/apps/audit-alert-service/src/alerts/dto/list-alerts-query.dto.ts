import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { AlertSeverity, AlertStatus, AlertType } from '@app/contracts';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class ListAlertsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(Object.values(AlertStatus))
  status?: string;

  @IsOptional()
  @IsIn(Object.values(AlertType))
  type?: string;

  @IsOptional()
  @IsIn(Object.values(AlertSeverity))
  severity?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  workerId?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  siteId?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  credentialNumber?: string;
}