import { apiClient } from './client';

export interface Customer {
  id: string;
  name: string | null;
  phone: string | null;
  gstNumber: string | null;
  loyaltyPoints: number;
  createdAt: string;
}

export const CustomersClient = {
  list: (q?: string): Promise<Customer[]> =>
    apiClient.get('/customers', q ? { params: { q } } : undefined),
  create: (payload: { name?: string; phone?: string; gstNumber?: string }): Promise<Customer> =>
    apiClient.post('/customers', payload),
  update: (id: string, payload: { name?: string; phone?: string; gstNumber?: string }): Promise<Customer> =>
    apiClient.patch(`/customers/${id}`, payload),
};
