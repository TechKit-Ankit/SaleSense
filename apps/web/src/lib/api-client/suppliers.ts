import { apiClient } from './client';

export interface Supplier {
  id: string;
  storeId: string;
  name: string;
  phone: string | null;
  gstNumber: string | null;
  address: string | null;
  status: 'ACTIVE' | 'ARCHIVED';
  createdAt: string;
}

export const SuppliersService = {
  findAll: () => apiClient.get('/suppliers'),
  findOne: (id: string) => apiClient.get(`/suppliers/${id}`),
  create: (data: Partial<Supplier>) => apiClient.post('/suppliers', data),
  update: (id: string, data: Partial<Supplier>) => apiClient.patch(`/suppliers/${id}`, data),
  remove: (id: string) => apiClient.delete(`/suppliers/${id}`),
};
