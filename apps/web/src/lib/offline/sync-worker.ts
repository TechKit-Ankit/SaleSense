import { syncQueue } from './sync-queue';
import { SalesClient } from '../api-client/sales';
import { toast } from 'sonner';

let isSyncing = false;

export const startBackgroundSync = (storeId: string) => {
  if (typeof window === 'undefined') return;

  // Sync on mount
  attemptSync(storeId);

  // Sync when coming back online
  window.addEventListener('online', () => {
    console.log('Network restored. Attempting sync...');
    attemptSync(storeId);
  });

  // Fallback polling (every 60 seconds)
  setInterval(() => {
    if (navigator.onLine) {
      attemptSync(storeId);
    }
  }, 60 * 1000);
};

export const attemptSync = async (storeId: string) => {
  if (isSyncing || !navigator.onLine) return;

  try {
    isSyncing = true;
    const pendingSales = await syncQueue.getPendingSales(storeId);

    if (pendingSales.length === 0) return;

    console.log(`Syncing ${pendingSales.length} offline sales...`);

    // Ensure the backend records these as delayed/offline sales.
    const payloads = pendingSales.map((s) => ({
      ...s.payload,
      saleSource: 'OFFLINE_SYNC' as const,
    }));

    const result = await SalesClient.syncSales(storeId, payloads);
    if (!result) return;

    const { synced = [], failed = [] } = result;

    // De-queue every sale the server accepted. Match on the client mutation id
    // (clientSaleId, falling back to the idempotency key used as the queue key).
    const keysToRemove: string[] = [];
    let reconciliationCount = 0;

    for (const s of synced) {
      const match = pendingSales.find(
        (p) => (p.payload.clientSaleId ?? p.idempotencyKey) === s.clientMutationId,
      );
      if (match) keysToRemove.push(match.idempotencyKey);
      if (s.requiresReconciliation) reconciliationCount += 1;
    }

    if (keysToRemove.length > 0) {
      await syncQueue.removeMultiple(keysToRemove);
      console.log(`Successfully synced ${keysToRemove.length} sales.`);
    }

    // A synced sale that drove stock negative is still committed — surface it
    // so an owner/manager can reconcile inventory.
    if (reconciliationCount > 0) {
      toast.warning(
        `${reconciliationCount} synced sale(s) need stock reconciliation.`,
      );
    }

    // Failed sales stay in the queue and retry on the next tick.
    if (failed.length > 0) {
      console.warn(
        `${failed.length} offline sale(s) failed to sync and remain queued`,
        failed.map((f) => f.error?.code),
      );
    }
  } catch (error) {
    console.error('Offline sync failed', error);
  } finally {
    isSyncing = false;
  }
};
