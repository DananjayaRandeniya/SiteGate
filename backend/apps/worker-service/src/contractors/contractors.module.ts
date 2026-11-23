import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ContractorsController } from './contractors.controller';
import { ContractorsRepository } from './contractors.repository';
import { ContractorsService } from './contractors.service';
import { Contractor, ContractorSchema } from './schemas/contractor.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Contractor.name, schema: ContractorSchema },
    ]),
  ],
  controllers: [ContractorsController],
  providers: [ContractorsRepository, ContractorsService],
  exports: [ContractorsService],
})
export class ContractorsModule {}
