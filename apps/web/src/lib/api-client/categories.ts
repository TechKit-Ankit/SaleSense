import { apiClient } from './client';

export interface Category {
  id: string;
  storeId: string;
  name: string;
  parentId: string | null;
  status: 'ACTIVE' | 'ARCHIVED';
  createdAt: string;
  updatedAt: string;
}

export const CategoriesService = {
  findAll: () => apiClient.get('/categories'),
  findOne: (id: string) => apiClient.get(`/categories/${id}`),
  create: (data: Partial<Category>) => apiClient.post('/categories', data),
  update: (id: string, data: Partial<Category>) => apiClient.patch(`/categories/${id}`, data),
  remove: (id: string) => apiClient.delete(`/categories/${id}`),
};
