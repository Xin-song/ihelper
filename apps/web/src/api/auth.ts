import type {
  ChangePasswordInput,
  LoginInput,
  UpdateProfileInput,
  UserDto,
} from '@ihelper/shared';
import { apiClient } from './client';

export const authApi = {
  login: (payload: LoginInput) =>
    apiClient.post<UserDto>('/auth/login', payload).then((r) => r.data),
  logout: () => apiClient.post('/auth/logout').then((r) => r.data),
  me: () => apiClient.get<UserDto>('/auth/me').then((r) => r.data),
  updateProfile: (payload: UpdateProfileInput) =>
    apiClient.patch<UserDto>('/auth/me', payload).then((r) => r.data),
  changePassword: (payload: ChangePasswordInput) =>
    apiClient.post('/auth/password', payload).then((r) => r.data),
};
