import { Injectable } from '@nestjs/common';
import type { Types } from 'mongoose';
import { DomainError } from '../common/domain-error';
import { ContractorsRepository } from './contractors.repository';
import type { ContractorDocument } from './schemas/contractor.schema';

function contractorNotFound() {
  return new DomainError('CONTRACTOR_NOT_FOUND', 'Contractor was not found');
}

function toContractorSummary(contractor: ContractorDocument | null) {
  if (!contractor) throw contractorNotFound();
  return { id: contractor._id.toString(), name: contractor.name };
}

@Injectable()
export class ContractorsService {
  constructor(private readonly contractors: ContractorsRepository) {}

  async create(name: string) {
    return toContractorSummary(await this.contractors.create(name));
  }

  async list() {
    const contractors = await this.contractors.findActive();
    return contractors.map(toContractorSummary);
  }

  async get(id: string) {
    return toContractorSummary(await this.contractors.findActiveById(id));
  }

  async namesByIds(ids: Types.ObjectId[]) {
    if (ids.length === 0) return new Map<string, string>();
    const rows = await this.contractors.findNamesByIds(ids);
    return new Map(rows.map(({ _id, name }) => [_id.toString(), name]));
  }

  async rename(id: string, name: string) {
    return toContractorSummary(await this.contractors.renameActive(id, name));
  }

  async archive(id: string) {
    const result = await this.contractors.archiveActive(id);
    if (result.matchedCount === 0) throw contractorNotFound();
  }
}
