import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { Direction } from '@app/contracts';

export class AccessRequestDto {
  @IsString()
  @IsNotEmpty()
  credentialNumber: string;

  @IsString()
  @IsNotEmpty()
  siteId: string;

  @IsString()
  @IsNotEmpty()
  gateId: string;

  @IsEnum(Direction)
  direction: Direction;
}