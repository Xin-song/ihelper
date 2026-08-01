import type { CreateSubmissionInput, SubmissionDto } from '@ihelper/shared';
import { apiClient } from './client';

export const submissionsApi = {
  /** 作业广场的全局信息流 */
  feed: () => apiClient.get<SubmissionDto[]>('/submissions').then((r) => r.data),

  /** 某道菜下的所有作业 */
  listByRecipe: (recipeId: string) =>
    apiClient.get<SubmissionDto[]>(`/recipes/${recipeId}/submissions`).then((r) => r.data),

  create: (recipeId: string, payload: CreateSubmissionInput) =>
    apiClient
      .post<SubmissionDto>(`/recipes/${recipeId}/submissions`, payload)
      .then((r) => r.data),

  like: (id: string) =>
    apiClient.post<SubmissionDto>(`/submissions/${id}/like`).then((r) => r.data),

  remove: (id: string) => apiClient.delete(`/submissions/${id}`).then((r) => r.data),
};
