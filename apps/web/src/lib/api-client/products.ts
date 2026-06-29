import { apiClient } from './client';
import { Category } from './categories';
import { Brand } from './brands';

export interface ProductBarcode {
  id: string;
  storeId: string;
  productId: string;
  barcode: string;
  isPrimary: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  id: string;
  storeId: string;
  globalProductId: string | null;
  categoryId: string | null;
  brandId: string | null;
  sku: string | null;
  name: string;
  description: string | null;
  hsnCode: string | null;
  taxRateBps: number;
  mrpPaise: number | null;
  sellingPricePaise: number;
  trackInventory: boolean;
  expiryTracked: boolean;
  status: 'ACTIVE' | 'ARCHIVED';
  createdAt: string;
  updatedAt: string;

  // Relations
  barcodes?: ProductBarcode[];
  category?: Category | null;
  brand?: Brand | null;
}

export const ProductsService = {
  findAll: () => apiClient.get('/products'),
  findOne: (id: string) => apiClient.get(`/products/${id}`),
  findByBarcode: (barcode: string) => apiClient.get(`/products/barcode/${barcode}`),
  create: (data: Partial<Product> & { barcode?: string }) => apiClient.post('/products', data),
  update: (id: string, data: Partial<Product>) => apiClient.patch(`/products/${id}`, data),
  remove: (id: string) => apiClient.delete(`/products/${id}`),
  addBarcode: (id: string, barcode: string) => apiClient.post(`/products/${id}/barcodes`, { barcode }),
  removeBarcode: (id: string, barcodeId: string) => apiClient.delete(`/products/${id}/barcodes/${barcodeId}`),
};
