import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { AccessDecisionService } from './access-decision.service';
import { AccessRequestDto } from './dto/access-request.dto';

@Controller('access-requests')
export class AccessRequestsController {
  constructor(private readonly decisions: AccessDecisionService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async requestAccess(@Body() dto: AccessRequestDto) {
    const decision = await this.decisions.decide(dto);
    return { result: decision.result, reasonCode: decision.reasonCode };
  }
}