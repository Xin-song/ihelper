import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { Injectable, Logger } from '@nestjs/common';
import { IncomingFile, StoredFile, StorageService } from './storage.service';

/** 允许的图片类型 → 落盘扩展名。白名单，不接受列表外的任何 mime */
const EXTENSION_BY_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

export const ALLOWED_IMAGE_MIME_TYPES = Object.keys(EXTENSION_BY_MIME);

/**
 * 落到本地磁盘。Phase 4 上云时换成 S3 实现，只要改 storage.module.ts 的 useClass。
 *
 * 文件名一律自己生成（UUID + 白名单扩展名），不复用用户传来的 originalName —— 那是
 * 路径穿越和覆盖已有文件的经典入口。按年月分目录，避免单目录堆几万个文件。
 */
@Injectable()
export class LocalDiskStorage extends StorageService {
  private readonly logger = new Logger(LocalDiskStorage.name);
  private readonly root: string;
  private readonly publicPrefix: string;

  constructor() {
    super();
    this.root = resolve(process.env.UPLOAD_DIR ?? join(process.cwd(), 'uploads'));
    this.publicPrefix = '/uploads';
  }

  /** 静态文件服务要挂载的物理目录，main.ts 用 */
  get rootDir(): string {
    return this.root;
  }

  /** 静态文件服务的 URL 前缀，main.ts 用 */
  get urlPrefix(): string {
    return this.publicPrefix;
  }

  async save(file: IncomingFile): Promise<StoredFile> {
    const ext = EXTENSION_BY_MIME[file.mimeType] ?? extname(file.originalName).toLowerCase();
    const now = new Date();
    const yyyy = String(now.getUTCFullYear());
    const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
    const key = `${yyyy}/${mm}/${randomUUID()}${ext}`;

    const target = join(this.root, key);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, file.buffer);

    return { key, url: `${this.publicPrefix}/${key}` };
  }

  async remove(key: string): Promise<void> {
    const target = resolve(this.root, key);
    // key 理论上都是我们自己生成的，但删除是不可逆操作，越界就直接拒绝而不是照做
    if (target !== this.root && !target.startsWith(this.root + sep)) {
      this.logger.warn(`拒绝删除越界路径：${key}`);
      return;
    }
    try {
      await unlink(target);
    } catch (error) {
      // 文件已经不在了不算错误——删除是幂等的
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }

  /** 把公开 URL 还原成 key；不是本存储的 URL 则返回 null */
  keyFromUrl(url: string): string | null {
    const prefix = `${this.publicPrefix}/`;
    return url.startsWith(prefix) ? url.slice(prefix.length) : null;
  }
}
