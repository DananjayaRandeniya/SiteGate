import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { AlertsManagementService } from './alerts-management.service';
import { ListAlertsQueryDto } from './dto/list-alerts-query.dto';
import { UpdateAlertStatusDto } from './dto/update-alert-status.dto';

@Controller('alerts')
export class AlertsController {
  constructor(private readonly management: AlertsManagementService) {}

  @Get()
  list(@Query() query: ListAlertsQueryDto) {
    return this.management.list(query);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.management.get(id);
  }

  @Patch(':id/status')
  changeStatus(@Param('id') id: string, @Body() body: UpdateAlertStatusDto) {
    return this.management.changeStatus(id, body.status);
  }
}