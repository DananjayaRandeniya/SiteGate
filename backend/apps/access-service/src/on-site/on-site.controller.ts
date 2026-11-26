import { Controller, Get, Param } from '@nestjs/common';
import { OnSiteService } from './on-site.service';

@Controller('sites')
export class OnSiteController {
  constructor(private readonly onSite: OnSiteService) {}

  @Get(':siteId/on-site')
  list(@Param('siteId') siteId: string) {
    return this.onSite.list(siteId);
  }
}