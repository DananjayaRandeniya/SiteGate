import { Test, type TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { ContractorsRepository } from './contractors.repository';
import { ContractorsService } from './contractors.service';

const id = '669f2a62d20bae6882af1870';
const row = {
  _id: new Types.ObjectId(id),
  name: 'Test Contractor',
  deletedAt: null,
};

describe('ContractorsService', () => {
  const repository = {
    create: jest.fn(),
    findActive: jest.fn(),
    findActiveById: jest.fn(),
    findNamesByIds: jest.fn(),
    renameActive: jest.fn(),
    archiveActive: jest.fn(),
  };
  let moduleRef: TestingModule;
  let service: ContractorsService;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [
        ContractorsService,
        { provide: ContractorsRepository, useValue: repository },
      ],
    }).compile();
    service = moduleRef.get(ContractorsService);
  });

  beforeEach(() => jest.resetAllMocks());
  afterAll(() => moduleRef.close());

  it('creates a contractor and returns only its ID and name', async () => {
    repository.create.mockResolvedValueOnce(row);
    await expect(service.create(row.name)).resolves.toEqual({
      id,
      name: row.name,
    });
    expect(repository.create).toHaveBeenCalledWith(row.name);
  });

  it('maps active contractor rows to directory entries', async () => {
    repository.findActive.mockResolvedValueOnce([row]);
    await expect(service.list()).resolves.toEqual([{ id, name: row.name }]);
  });

  it('looks up an active contractor and returns its summary', async () => {
    repository.findActiveById.mockResolvedValueOnce(row);
    await expect(service.get(id)).resolves.toEqual({ id, name: row.name });
    expect(repository.findActiveById).toHaveBeenCalledWith(id);
  });

  it('batches historical names and avoids a lookup for an empty page', async () => {
    await expect(service.namesByIds([])).resolves.toEqual(new Map());
    expect(repository.findNamesByIds).not.toHaveBeenCalled();
    repository.findNamesByIds.mockResolvedValueOnce([
      { ...row, deletedAt: new Date() },
    ]);

    await expect(service.namesByIds([row._id])).resolves.toEqual(
      new Map([[id, row.name]]),
    );
    expect(repository.findNamesByIds).toHaveBeenCalledWith([row._id]);
  });

  it('returns the new name after a successful rename', async () => {
    const name = 'Renamed Contractor';
    repository.renameActive.mockResolvedValueOnce({ ...row, name });
    await expect(service.rename(id, name)).resolves.toEqual({ id, name });
    expect(repository.renameActive).toHaveBeenCalledWith(id, name);
  });

  it('reports the same domain error for missing records on read, rename, or archive', async () => {
    repository.findActiveById.mockResolvedValueOnce(null);
    repository.renameActive.mockResolvedValueOnce(null);
    repository.archiveActive.mockResolvedValueOnce({ matchedCount: 0 });

    await expect(service.get(id)).rejects.toMatchObject({
      code: 'CONTRACTOR_NOT_FOUND',
    });
    await expect(service.rename(id, 'New Name')).rejects.toMatchObject({
      code: 'CONTRACTOR_NOT_FOUND',
    });
    await expect(service.archive(id)).rejects.toMatchObject({
      code: 'CONTRACTOR_NOT_FOUND',
    });
  });

  it('archives an active contractor without returning the database result', async () => {
    repository.archiveActive.mockResolvedValueOnce({ matchedCount: 1 });
    await expect(service.archive(id)).resolves.toBeUndefined();
    expect(repository.archiveActive).toHaveBeenCalledWith(id);
  });
});
