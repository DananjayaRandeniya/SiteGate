import { Module } from '@nestjs/common';
import { AccessLogModule } from '../access-log/access-log.module';
import { WorkerSnapshotsModule } from '../worker-snapshots/worker-snapshots.module';
import { OnSiteController } from './on-site.controller';
import { OnSiteService } from './on-site.service';

@Module({
  imports: [AccessLogModule, WorkerSnapshotsModule],
  controllers: [OnSiteController],
  providers: [OnSiteService],
})
export class OnSiteModule {}