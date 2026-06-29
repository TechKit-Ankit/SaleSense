import { openDB, IDBPDatabase } from 'idb';

const DB_NAME = 'SaleSenseOfflineDB';
const DB_VERSION = 1;
const STORE_NAME = 'pending_sales';

interface PendingSale {
  idempotencyKey: string;
  storeId: string;
  payload: any; // The CreateSaleDto
  createdAt: number;
}

class SyncQueueService {
  private dbPromise: Promise<IDBPDatabase>;

  constructor() {
    this.dbPromise = typeof window !== 'undefined' 
      ? openDB(DB_NAME, DB_VERSION, {
          upgrade(db) {
            if (!db.objectStoreNames.contains(STORE_NAME)) {
              db.createObjectStore(STORE_NAME, { keyPath: 'idempotencyKey' });
            }
          },
        })
      : Promise.resolve(null as any);
  }

  async addPendingSale(storeId: string, idempotencyKey: string, payload: any) {
    if (!this.dbPromise) return;
    const db = await this.dbPromise;
    await db.put(STORE_NAME, {
      idempotencyKey,
      storeId,
      payload,
      createdAt: Date.now(),
    } as PendingSale);
  }

  async getPendingSales(storeId: string): Promise<PendingSale[]> {
    if (!this.dbPromise) return [];
    const db = await this.dbPromise;
    const all = await db.getAll(STORE_NAME);
    return all.filter((s: PendingSale) => s.storeId === storeId);
  }

  async removePendingSale(idempotencyKey: string) {
    if (!this.dbPromise) return;
    const db = await this.dbPromise;
    await db.delete(STORE_NAME, idempotencyKey);
  }

  async removeMultiple(idempotencyKeys: string[]) {
    if (!this.dbPromise) return;
    const db = await this.dbPromise;
    const tx = db.transaction(STORE_NAME, 'readwrite');
    for (const key of idempotencyKeys) {
      tx.store.delete(key);
    }
    await tx.done;
  }
}

export const syncQueue = new SyncQueueService();
