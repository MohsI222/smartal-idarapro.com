/**
 * IndexedDB layer for offline storage
 * Stores orders, products, and pending operations for sync
 */
import { openDB, DBSchema, IDBPDatabase } from 'idb';

// Export types for use in other modules
export type PendingOperation = {
  id: string;
  type: 'create_order' | 'update_order_status' | 'update_product' | 'create_product';
  payload: any;
  timestamp: number;
  retryCount: number;
};

interface OfflineDB extends DBSchema {
  orders: {
    key: string;
    value: {
      id: string;
      store_id: string;
      customer_name: string;
      customer_phone: string;
      address?: string;
      notes?: string;
      lat?: number | null;
      lng?: number | null;
      total: number;
      status: string;
      created_at: string;
      order_items: Array<{
        id: string;
        order_id: string;
        product_id: string | null;
        title: string;
        price: number;
        quantity: number;
      }>;
    };
    indexes: {
      'by-store': string;
      'by-status': string;
      'by-created': string;
    };
  };
  products: {
    key: string;
    value: {
      id: string;
      store_id: string;
      title: string;
      category?: string;
      price: number;
      original_price?: number | null;
      stock_quantity: number;
      low_stock_threshold: number;
      description?: string | null;
      image_url?: string | null;
      video_url?: string | null;
      in_stock: boolean;
      sort_order: number;
      sku?: string | null;
      created_at: string;
      updated_at: string;
    };
    indexes: {
      'by-store': string;
      'by-category': string;
    };
  };
  pendingOperations: {
    key: string;
    value: {
      id: string;
      type: 'create_order' | 'update_order_status' | 'update_product' | 'create_product';
      payload: any;
      timestamp: number;
      retryCount: number;
    };
    indexes: {
      'by-timestamp': number;
    };
  };
}

const DB_NAME = 'smart-al-idara-offline';
const DB_VERSION = 1;

let dbInstance: IDBPDatabase<OfflineDB> | null = null;

async function getDB(): Promise<IDBPDatabase<OfflineDB>> {
  if (dbInstance) return dbInstance;
  
  dbInstance = await openDB<OfflineDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Orders store
      if (!db.objectStoreNames.contains('orders')) {
        const ordersStore = db.createObjectStore('orders', { keyPath: 'id' });
        ordersStore.createIndex('by-store', 'store_id');
        ordersStore.createIndex('by-status', 'status');
        ordersStore.createIndex('by-created', 'created_at');
      }

      // Products store
      if (!db.objectStoreNames.contains('products')) {
        const productsStore = db.createObjectStore('products', { keyPath: 'id' });
        productsStore.createIndex('by-store', 'store_id');
        productsStore.createIndex('by-category', 'category');
      }

      // Pending operations store
      if (!db.objectStoreNames.contains('pendingOperations')) {
        const pendingStore = db.createObjectStore('pendingOperations', { keyPath: 'id' });
        pendingStore.createIndex('by-timestamp', 'timestamp');
      }
    },
  });

  return dbInstance;
}

// Orders operations
export async function saveOrderOffline(order: OfflineDB['orders']['value']): Promise<void> {
  const db = await getDB();
  await db.put('orders', order);
}

export async function getOrdersOffline(storeId: string): Promise<OfflineDB['orders']['value'][]> {
  const db = await getDB();
  return db.getAllFromIndex('orders', 'by-store', storeId);
}

export async function getOrderOffline(orderId: string): Promise<OfflineDB['orders']['value'] | undefined> {
  const db = await getDB();
  return db.get('orders', orderId);
}

export async function deleteOrderOffline(orderId: string): Promise<void> {
  const db = await getDB();
  await db.delete('orders', orderId);
}

// Products operations
export async function saveProductOffline(product: OfflineDB['products']['value']): Promise<void> {
  const db = await getDB();
  await db.put('products', product);
}

export async function getProductsOffline(storeId: string): Promise<OfflineDB['products']['value'][]> {
  const db = await getDB();
  return db.getAllFromIndex('products', 'by-store', storeId);
}

export async function getProductOffline(productId: string): Promise<OfflineDB['products']['value'] | undefined> {
  const db = await getDB();
  return db.get('products', productId);
}

export async function deleteProductOffline(productId: string): Promise<void> {
  const db = await getDB();
  await db.delete('products', productId);
}

// Pending operations
export async function addPendingOperation(
  type: OfflineDB['pendingOperations']['value']['type'],
  payload: any
): Promise<void> {
  const db = await getDB();
  const operation = {
    id: `${type}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    type,
    payload,
    timestamp: Date.now(),
    retryCount: 0,
  };
  await db.put('pendingOperations', operation);
}

export async function getPendingOperations(): Promise<OfflineDB['pendingOperations']['value'][]> {
  const db = await getDB();
  return db.getAll('pendingOperations');
}

export async function deletePendingOperation(operationId: string): Promise<void> {
  const db = await getDB();
  await db.delete('pendingOperations', operationId);
}

export async function incrementRetryCount(operationId: string): Promise<void> {
  const db = await getDB();
  const operation = await db.get('pendingOperations', operationId);
  if (operation) {
    operation.retryCount += 1;
    await db.put('pendingOperations', operation);
  }
}

// Clear all data (for logout or reset)
export async function clearOfflineData(): Promise<void> {
  const db = await getDB();
  await db.clear('orders');
  await db.clear('products');
  await db.clear('pendingOperations');
}

// Check if we have offline data
export async function hasOfflineData(): Promise<boolean> {
  const db = await getDB();
  const ordersCount = await db.count('orders');
  const productsCount = await db.count('products');
  const pendingCount = await db.count('pendingOperations');
  return ordersCount > 0 || productsCount > 0 || pendingCount > 0;
}
