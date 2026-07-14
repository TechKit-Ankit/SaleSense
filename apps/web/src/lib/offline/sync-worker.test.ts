import { attemptSync } from './sync-worker';
import { syncQueue } from './sync-queue';
import { SalesClient } from '../api-client/sales';
import { toast } from 'sonner';

jest.mock('./sync-queue', () => ({
  syncQueue: {
    getPendingSales: jest.fn(),
    removeMultiple: jest.fn(),
  },
}));
jest.mock('../api-client/sales', () => ({
  SalesClient: { syncSales: jest.fn() },
}));
jest.mock('sonner', () => ({
  toast: { warning: jest.fn() },
}));

const mockQueue = syncQueue as jest.Mocked<typeof syncQueue>;
const mockSales = SalesClient as jest.Mocked<typeof SalesClient>;

const pending = (idempotencyKey: string, clientSaleId: string) => ({
  idempotencyKey,
  storeId: 'store_1',
  payload: { clientSaleId, idempotencyKey, saleSource: 'ONLINE', items: [], payments: [] },
  createdAt: Date.now(),
});

describe('attemptSync (offline queue → server contract)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(window.navigator, 'onLine', { value: true, configurable: true });
  });

  it('de-queues synced sales by clientMutationId and leaves failed ones for retry', async () => {
    mockQueue.getPendingSales.mockResolvedValue([pending('k1', 'c1'), pending('k2', 'c2')] as any);
    mockSales.syncSales.mockResolvedValue({
      synced: [{ clientSaleId: 'c1', clientMutationId: 'c1', saleId: 's1', invoiceId: null, status: 'SYNCED', requiresReconciliation: false, warnings: [] }],
      failed: [{ clientSaleId: 'c2', clientMutationId: 'c2', status: 'FAILED', error: { code: 'INTERNAL_ERROR', message: 'x' } }],
    } as any);

    await attemptSync('store_1');

    // only the SYNCED sale is removed; the failed one stays queued
    expect(mockQueue.removeMultiple).toHaveBeenCalledWith(['k1']);
    // payloads are rewritten to OFFLINE_SYNC before hitting the server
    expect(mockSales.syncSales).toHaveBeenCalledWith(
      'store_1',
      expect.arrayContaining([expect.objectContaining({ saleSource: 'OFFLINE_SYNC' })]),
    );
  });

  it('raises a reconciliation toast when a synced sale oversold stock', async () => {
    mockQueue.getPendingSales.mockResolvedValue([pending('k1', 'c1')] as any);
    mockSales.syncSales.mockResolvedValue({
      synced: [{ clientSaleId: 'c1', clientMutationId: 'c1', saleId: 's1', invoiceId: null, status: 'SYNCED', requiresReconciliation: true, warnings: [{ code: 'STOCK_RECONCILIATION_REQUIRED', message: 'm' }] }],
      failed: [],
    } as any);

    await attemptSync('store_1');

    expect(toast.warning).toHaveBeenCalledWith(expect.stringContaining('1 synced sale(s) need stock reconciliation'));
  });

  it('does nothing while offline', async () => {
    Object.defineProperty(window.navigator, 'onLine', { value: false, configurable: true });

    await attemptSync('store_1');

    expect(mockQueue.getPendingSales).not.toHaveBeenCalled();
    expect(mockSales.syncSales).not.toHaveBeenCalled();
  });

  it('does nothing when the queue is empty', async () => {
    mockQueue.getPendingSales.mockResolvedValue([] as any);

    await attemptSync('store_1');

    expect(mockSales.syncSales).not.toHaveBeenCalled();
  });

  it('a server error leaves the whole queue untouched (retry next tick)', async () => {
    mockQueue.getPendingSales.mockResolvedValue([pending('k1', 'c1')] as any);
    mockSales.syncSales.mockRejectedValue(new Error('network down'));

    await expect(attemptSync('store_1')).resolves.toBeUndefined();
    expect(mockQueue.removeMultiple).not.toHaveBeenCalled();
  });
});
