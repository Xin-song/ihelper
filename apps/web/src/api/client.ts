import axios from 'axios';

export const apiClient = axios.create({
  baseURL: '/api/v1',
  timeout: 10000,
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = error?.response?.data?.message ?? error.message ?? '请求失败';
    return Promise.reject(new Error(Array.isArray(message) ? message.join('；') : message));
  },
);
