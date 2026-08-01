import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { LocalDiskStorage } from './storage/local-disk.storage';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.setGlobalPrefix('api/v1');
  app.enableCors({ origin: true, credentials: true });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // 上传的图片走静态目录，不加 api/v1 前缀 —— 这些是资源不是接口。
  // 换成 S3 存储后这段整个删掉，URL 直接指向对象存储。
  const storage = app.get(LocalDiskStorage);
  app.useStaticAssets(storage.rootDir, { prefix: storage.urlPrefix });

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
