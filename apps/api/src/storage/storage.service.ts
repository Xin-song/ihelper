/**
 * 存储抽象层，见 ARCHITECTURE.md「图片存储抽象层（本地磁盘 ↔ S3 兼容对象存储可切换）」。
 *
 * 刻意不依赖 Express.Multer.File —— 换成 S3 实现时不该被 HTTP 层的类型绑住。
 * 控制器负责把上传的文件转成 IncomingFile 再交给这里。
 */

export interface IncomingFile {
  /** 用户原始文件名，只用来取扩展名，绝不直接当落盘路径 */
  originalName: string;
  mimeType: string;
  buffer: Buffer;
  size: number;
}

export interface StoredFile {
  /** 存储层内部标识（本地实现是相对路径，S3 实现是 object key），删除时用 */
  key: string;
  /** 前端可直接访问的 URL */
  url: string;
}

export abstract class StorageService {
  abstract save(file: IncomingFile): Promise<StoredFile>;
  abstract remove(key: string): Promise<void>;
}
