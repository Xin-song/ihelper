import type { CreateStockItemInput, StockItemDto, UpdateStockItemInput } from '@ihelper/shared';
import { apiClient } from './client';

export const inventoryApi = {
  list: () => apiClient.get<StockItemDto[]>('/inventory').then((r) => r.data),
  lowStock: () => apiClient.get<StockItemDto[]>('/inventory/low-stock').then((r) => r.data),
  create: (payload: CreateStockItemInput) =>
    apiClient.post<StockItemDto>('/inventory', payload).then((r) => r.data),
  update: (id: string, payload: UpdateStockItemInput) =>
    apiClient.patch<StockItemDto>(`/inventory/${id}`, payload).then((r) => r.data),
  adjust: (id: string, delta: number) =>
    apiClient.post<StockItemDto>(`/inventory/${id}/adjust`, { delta }).then((r) => r.data),
  remove: (id: string) => apiClient.delete(`/inventory/${id}`).then((r) => r.data),
};
