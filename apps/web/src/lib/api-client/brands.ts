import { apiClient } from './client';

export interface Brand {
  id: string;
  storeId: string;
  name: string;
  status: 'ACTIVE' | 'ARCHIVED';
  createdAt: string;
  updatedAt: string;
}

export const BrandsService = {
  findAll: () => apiClient.get('/brands'),
  findOne: (id: string) => apiClient.get(`/brands/${id}`),
  create: (data: Partial<Brand>) => apiClient.post('/brands', data),
  update: (id: string, data: Partial<Brand>) => apiClient.patch(`/brands/${id}`, data),
  remove: (id: string) => apiClient.delete(`/brands/${id}`),
};
