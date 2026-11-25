import { IsIn } from 'class-validator';
import { AlertStatus } from '@app/contracts';

export class UpdateAlertStatusDto {
  // "Open" is not allowed here: an alert can only move forward
  @IsIn([AlertStatus.ACKNOWLEDGED, AlertStatus.RESOLVED])
  status!: string;
}