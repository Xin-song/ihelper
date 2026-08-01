import type { CreateIngredientInput, IngredientDto } from '@ihelper/shared';
import { apiClient } from './client';

export const ingredientsApi = {
  list: (query?: string) =>
    apiClient.get<IngredientDto[]>('/ingredients', { params: { query } }).then((r) => r.data),
  create: (payload: CreateIngredientInput) =>
    apiClient.post<IngredientDto>('/ingredients', payload).then((r) => r.data),
};
