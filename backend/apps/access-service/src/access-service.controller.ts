import { Controller, Get } from '@nestjs/common';
import { AccessServiceService } from './access-service.service';

@Controller()
export class AccessServiceController {
  constructor(private readonly accessServiceService: AccessServiceService) {}

  @Get()
  getHello(): string {
    return this.accessServiceService.getHello();
  }
}
