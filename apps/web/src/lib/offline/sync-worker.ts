import { syncQueue } from './sync-queue';
import { SalesClient } from '../api-client/sales';

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
    
    if (pendingSales.length === 0) {
      isSyncing = false;
      return;
    }

    console.log(`Syncing ${pendingSales.length} offline sales...`);

    // Prepare payload
    const payloads = pendingSales.map(s => {
      return {
        ...s.payload,
        saleSource: 'OFFLINE_SYNC', // Rewrite source so backend knows it was delayed
      };
    });

    const response = await SalesClient.syncSales(storeId, payloads);
    
    if (response.success && response.data) {
      const { synced, failed } = response.data;
      
      const keysToRemove: string[] = [];

      // Clean up successfully synced
      synced.forEach((s: any) => {
        const match = pendingSales.find(p => p.payload.clientSaleId === s.clientSaleId);
        if (match) keysToRemove.push(match.idempotencyKey);
      });

      // Handle failed ones (e.g., bad request, missing products). 
      // For MVP, we'll keep them in queue unless it's a fatal error, but typically we might alert user.
      
      if (keysToRemove.length > 0) {
        await syncQueue.removeMultiple(keysToRemove);
        console.log(`Successfully synced ${keysToRemove.length} sales.`);
      }
    }
  } catch (error) {
    console.error('Offline sync failed', error);
  } finally {
    isSyncing = false;
  }
};
