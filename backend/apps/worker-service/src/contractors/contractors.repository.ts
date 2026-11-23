import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model, Types } from 'mongoose';
import { Contractor } from './schemas/contractor.schema';

@Injectable()
export class ContractorsRepository {
  constructor(
    @InjectModel(Contractor.name)
    private readonly contractors: Model<Contractor>,
  ) {}

  create(name: string) {
    return this.contractors.create({ name });
  }

  findActive() {
    return this.contractors.find({ deletedAt: null }).sort({ name: 1 }).exec();
  }

  findActiveById(id: string) {
    return this.contractors.findOne({ _id: id, deletedAt: null }).exec();
  }

  findNamesByIds(ids: Types.ObjectId[]) {
    return this.contractors
      .find({ _id: { $in: ids } })
      .select('name')
      .exec();
  }

  renameActive(id: string, name: string) {
    return this.contractors
      .findOneAndUpdate(
        { _id: id, deletedAt: null },
        { $set: { name } },
        { returnDocument: 'after', runValidators: true },
      )
      .exec();
  }

  archiveActive(id: string) {
    return this.contractors
      .updateOne(
        { _id: id, deletedAt: null },
        { $set: { deletedAt: new Date() } },
      )
      .exec();
  }
}
