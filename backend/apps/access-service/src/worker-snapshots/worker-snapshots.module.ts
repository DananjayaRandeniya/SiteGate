import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  WorkerSnapshot,
  WorkerSnapshotSchema,
} from './schemas/worker-snapshot.schema';
import { WorkerSnapshotsRepository } from './worker-snapshots.repository';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: WorkerSnapshot.name, schema: WorkerSnapshotSchema },
    ]),
  ],
  providers: [WorkerSnapshotsRepository],
  exports: [WorkerSnapshotsRepository],
})
export class WorkerSnapshotsModule {}