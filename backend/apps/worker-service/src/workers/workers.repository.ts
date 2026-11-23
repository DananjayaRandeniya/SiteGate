import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { type Model, mongo, Types } from 'mongoose';
import { DomainError } from '../common/domain-error';
import type { CreateWorkerDto } from './dto/create-worker.dto';
import { Worker } from './schemas/worker.schema';

@Injectable()
export class WorkersRepository {
  constructor(
    @InjectModel(Worker.name) private readonly workers: Model<Worker>,
  ) {}

  async create(input: CreateWorkerDto) {
    try {
      return await this.workers.create({
        fullName: input.fullName,
        contractorId: new Types.ObjectId(input.contractorId),
        inductionDate: new Date(input.inductionDate),
        safetyTicketExpiry: new Date(input.safetyTicketExpiry),
        assignedSiteIds: input.assignedSiteIds,
        credentials: [{ number: input.credentialNumber }],
      });
    } catch (error) {
      if (
        error instanceof mongo.MongoServerError &&
        error.code === 11000 &&
        Object.hasOwn(error.keyPattern ?? {}, 'credentials.number')
      ) {
        throw new DomainError(
          'CREDENTIAL_IN_USE',
          'This credential is already in use',
        );
      }
      throw error;
    }
  }
}
