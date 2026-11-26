import { AlertStatus } from '@app/contracts';
import type { AlertsRepository } from './alerts.repository';
import type { AlertView } from './alerts.repository';
import type { ListAlertsQueryDto } from './dto/list-alerts-query.dto';
import { AlertNotFoundError, InvalidAlertTransitionError } from './errors';
import { AlertsManagementService } from './alerts-management.service';

// A small alert with only the fields these tests need.
const makeAlert = (status: string) => ({ id: 'alert-1', status }) as unknown as AlertView;

describe('AlertsManagementService', () => {
  const findPage = jest.fn();
  const findById = jest.fn();
  const changeStatus = jest.fn();
  // Only these three methods are used, so a small fake is enough.
  const repository = { findPage, findById, changeStatus } as unknown as AlertsRepository;
  const service = new AlertsManagementService(repository);

  beforeEach(() => {
    findPage.mockReset();
    findById.mockReset();
    changeStatus.mockReset();
  });

  describe('get', () => {
    it('returns the alert when it exists', async () => {
      const alert = makeAlert(AlertStatus.OPEN);
      findById.mockResolvedValue(alert);

      await expect(service.get('alert-1')).resolves.toBe(alert);
    });

    it('throws AlertNotFoundError when it does not exist', async () => {
      findById.mockResolvedValue(null);

      await expect(service.get('missing')).rejects.toThrow(AlertNotFoundError);
    });
  });

  describe('changeStatus', () => {
    it.each([
      [AlertStatus.OPEN, AlertStatus.ACKNOWLEDGED],
      [AlertStatus.OPEN, AlertStatus.RESOLVED],
      [AlertStatus.ACKNOWLEDGED, AlertStatus.RESOLVED],
    ])('allows %s to %s', async (from, to) => {
      const updated = makeAlert(to);
      findById.mockResolvedValue(makeAlert(from));
      changeStatus.mockResolvedValue(updated);

      await expect(service.changeStatus('alert-1', to)).resolves.toBe(updated);
      expect(changeStatus).toHaveBeenCalledWith('alert-1', from, to);
    });

    it.each([
      [AlertStatus.OPEN, AlertStatus.OPEN],
      [AlertStatus.ACKNOWLEDGED, AlertStatus.ACKNOWLEDGED],
      [AlertStatus.ACKNOWLEDGED, AlertStatus.OPEN],
      [AlertStatus.RESOLVED, AlertStatus.ACKNOWLEDGED],
      [AlertStatus.RESOLVED, AlertStatus.RESOLVED],
    ])('rejects %s to %s and does not update', async (from, to) => {
      findById.mockResolvedValue(makeAlert(from));

      await expect(service.changeStatus('alert-1', to)).rejects.toThrow(
        InvalidAlertTransitionError,
      );
      expect(changeStatus).not.toHaveBeenCalled();
    });

    it('throws AlertNotFoundError when the alert does not exist', async () => {
      findById.mockResolvedValue(null);

      await expect(service.changeStatus('missing', AlertStatus.RESOLVED)).rejects.toThrow(
        AlertNotFoundError,
      );
    });

    it('throws InvalidAlertTransitionError when someone changed the alert in between', async () => {
      findById.mockResolvedValue(makeAlert(AlertStatus.OPEN));
      changeStatus.mockResolvedValue(null); // the conditional update found no match

      await expect(service.changeStatus('alert-1', AlertStatus.RESOLVED)).rejects.toThrow(
        InvalidAlertTransitionError,
      );
    });
  });

  describe('list', () => {
    it('sends only the filters the caller gave, and calculates the page offset', async () => {
      findPage.mockResolvedValue({ items: [makeAlert(AlertStatus.OPEN)], total: 25 });
      const query = { page: 3, pageSize: 10, status: AlertStatus.OPEN } as ListAlertsQueryDto;

      const result = await service.list(query);

      expect(findPage).toHaveBeenCalledWith({ status: AlertStatus.OPEN }, 20, 10);
      expect(result).toEqual({
        data: [makeAlert(AlertStatus.OPEN)],
        page: 3,
        pageSize: 10,
        total: 25,
      });
    });

    it('uses an empty filter when no filters are given', async () => {
      findPage.mockResolvedValue({ items: [], total: 0 });
      const query = { page: 1, pageSize: 20 } as ListAlertsQueryDto;

      await service.list(query);

      expect(findPage).toHaveBeenCalledWith({}, 0, 20);
    });
  });
});