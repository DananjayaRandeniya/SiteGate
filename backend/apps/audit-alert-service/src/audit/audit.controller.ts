import { Controller, Get, Param, Query } from '@nestjs/common';
import { AuditService } from './audit.service';
import { AuditQueryDto } from './dto/audit-query.dto';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('audit')

@Controller('workers')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}
  @ApiOperation({ summary: 'Get audit trail for a worker' })

  // HTTP only: no business logic and no database code here
  @Get(':id/audit')
  getWorkerAudit(@Param('id') id: string, @Query() query: AuditQueryDto) {
    return this.auditService.getWorkerAudit(id, query);
  }
}