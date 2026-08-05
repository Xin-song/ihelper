import type { CreateTaskTopicInput, TaskTopicDto, UpdateTaskTopicInput } from '@ihelper/shared';
import { apiClient } from './client';

export const taskTopicsApi = {
  list: () => apiClient.get<TaskTopicDto[]>('/task-topics').then((r) => r.data),
  create: (payload: CreateTaskTopicInput) =>
    apiClient.post<TaskTopicDto>('/task-topics', payload).then((r) => r.data),
  update: (id: string, payload: UpdateTaskTopicInput) =>
    apiClient.patch<TaskTopicDto>(`/task-topics/${id}`, payload).then((r) => r.data),
  remove: (id: string) => apiClient.delete(`/task-topics/${id}`).then((r) => r.data),
};
