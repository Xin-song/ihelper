import type {
  CreatePrintImageInput,
  CreateRecipeInput,
  RecipeDetailDto,
  RecipeListItemDto,
  RecipePrintImageDto,
} from '@ihelper/shared';
import { apiClient } from './client';

export const recipesApi = {
  list: () => apiClient.get<RecipeListItemDto[]>('/recipes').then((r) => r.data),
  /** 菜谱广场：只返回 visibility = public 的 */
  square: () => apiClient.get<RecipeListItemDto[]>('/recipes/square').then((r) => r.data),
  get: (id: string) => apiClient.get<RecipeDetailDto>(`/recipes/${id}`).then((r) => r.data),
  create: (payload: CreateRecipeInput) =>
    apiClient.post<RecipeDetailDto>('/recipes', payload).then((r) => r.data),
  update: (id: string, payload: Partial<CreateRecipeInput>) =>
    apiClient.patch<RecipeDetailDto>(`/recipes/${id}`, payload).then((r) => r.data),
  remove: (id: string) => apiClient.delete(`/recipes/${id}`).then((r) => r.data),

  addPrintImage: (id: string, payload: CreatePrintImageInput) =>
    apiClient.post<RecipePrintImageDto>(`/recipes/${id}/print-images`, payload).then((r) => r.data),
  removePrintImage: (id: string, imageId: string) =>
    apiClient.delete(`/recipes/${id}/print-images/${imageId}`).then((r) => r.data),
};
