import type { CreateTaskInput, TaskDto, TaskStatus, UpdateTaskInput } from '@ihelper/shared';
import { apiClient } from './client';

export interface FindTasksParams {
  status?: TaskStatus;
  from?: string;
  to?: string;
  topicId?: string;
}

export const tasksApi = {
  list: (params?: FindTasksParams) =>
    apiClient.get<TaskDto[]>('/tasks', { params }).then((r) => r.data),
  create: (payload: CreateTaskInput) =>
    apiClient.post<TaskDto>('/tasks', payload).then((r) => r.data),
  update: (id: string, payload: UpdateTaskInput) =>
    apiClient.patch<TaskDto>(`/tasks/${id}`, payload).then((r) => r.data),
  remove: (id: string) => apiClient.delete(`/tasks/${id}`).then((r) => r.data),
};
