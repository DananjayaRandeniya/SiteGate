import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AlertsManagementService } from './alerts-management.service';
import { ListAlertsQueryDto } from './dto/list-alerts-query.dto';
import { UpdateAlertStatusDto } from './dto/update-alert-status.dto';

@ApiTags('alerts')
@Controller('alerts')
export class AlertsController {
  constructor(private readonly management: AlertsManagementService) {}

  @ApiOperation({ summary: 'List alerts with filters' })
  @Get()
  list(@Query() query: ListAlertsQueryDto) {
    return this.management.list(query);
  }

  @ApiOperation({ summary: 'Get a single alert by id' })
  @Get(':id')
  get(@Param('id') id: string) {
    return this.management.get(id);
  }

  @ApiOperation({ summary: 'Change alert status (Open, Acknowledged, Resolved)' })
  @Patch(':id/status')
  changeStatus(@Param('id') id: string, @Body() body: UpdateAlertStatusDto) {
    return this.management.changeStatus(id, body.status);
  }
}