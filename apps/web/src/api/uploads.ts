import type { UploadedImageDto } from '@ihelper/shared';
import { apiClient } from './client';

export const uploadsApi = {
  /** 图片上传的唯一入口：封面、打印版、作业成品图都走这里 */
  images: (files: File[]) => {
    const form = new FormData();
    files.forEach((file) => form.append('files', file));
    return apiClient
      .post<UploadedImageDto[]>('/uploads/images', form, {
        // 图片比 JSON 慢得多，10 秒的全局超时不够
        timeout: 60_000,
      })
      .then((r) => r.data);
  },
};
