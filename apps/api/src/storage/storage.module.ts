import { Global, Module } from '@nestjs/common';
import { LocalDiskStorage } from './local-disk.storage';
import { StorageService } from './storage.service';

/**
 * 换存储后端只动这里：把 useClass 指向新的实现（如 S3Storage）即可，
 * 业务代码注入的都是抽象的 StorageService。
 */
@Global()
@Module({
  providers: [LocalDiskStorage, { provide: StorageService, useClass: LocalDiskStorage }],
  exports: [StorageService, LocalDiskStorage],
})
export class StorageModule {}
