import {
  BadRequestException,
  Controller,
  Post,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { MAX_UPLOAD_FILES, MAX_UPLOAD_SIZE_BYTES, UploadedImageDto } from '@ihelper/shared';
import { ALLOWED_IMAGE_MIME_TYPES } from '../../storage/local-disk.storage';
import { StorageService } from '../../storage/storage.service';

@Controller('uploads')
export class UploadsController {
  constructor(private readonly storage: StorageService) {}

  /**
   * 图片上传。前端所有需要传图的地方（封面、打印版、作业成品图）都走这一个口子，
   * 拿到 url 后再写进各自的业务字段。
   */
  @Post('images')
  @UseInterceptors(
    FilesInterceptor('files', MAX_UPLOAD_FILES, {
      limits: { fileSize: MAX_UPLOAD_SIZE_BYTES, files: MAX_UPLOAD_FILES },
    }),
  )
  async uploadImages(
    @UploadedFiles() files: Express.Multer.File[],
  ): Promise<UploadedImageDto[]> {
    if (!files?.length) {
      throw new BadRequestException('没有收到文件');
    }

    // multer 的 limits 只挡大小和数量，类型要自己校验：白名单之外一律拒绝，
    // 且整批一起拒——避免只传上去一半、前端拿到半截结果
    const rejected = files.filter((f) => !ALLOWED_IMAGE_MIME_TYPES.includes(f.mimetype));
    if (rejected.length > 0) {
      throw new BadRequestException(
        `只支持 ${ALLOWED_IMAGE_MIME_TYPES.join('、')}，收到：${rejected
          .map((f) => f.mimetype)
          .join('、')}`,
      );
    }

    return Promise.all(
      files.map(async (file) => {
        const stored = await this.storage.save({
          originalName: file.originalname,
          mimeType: file.mimetype,
          buffer: file.buffer,
          size: file.size,
        });
        return { url: stored.url, key: stored.key };
      }),
    );
  }
}
