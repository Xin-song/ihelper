import type { CalendarEventDto, CreateEventInput, UpdateEventInput } from '@ihelper/shared';
import { apiClient } from './client';

export interface FindEventsParams {
  from?: string;
  to?: string;
}

export const calendarEventsApi = {
  list: (params?: FindEventsParams) =>
    apiClient.get<CalendarEventDto[]>('/calendar-events', { params }).then((r) => r.data),
  create: (payload: CreateEventInput) =>
    apiClient.post<CalendarEventDto>('/calendar-events', payload).then((r) => r.data),
  update: (id: string, payload: UpdateEventInput) =>
    apiClient.patch<CalendarEventDto>(`/calendar-events/${id}`, payload).then((r) => r.data),
  remove: (id: string) => apiClient.delete(`/calendar-events/${id}`).then((r) => r.data),
};
