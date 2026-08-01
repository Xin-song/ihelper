import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { StorageModule } from './storage/storage.module';
import { AuthModule } from './modules/auth/auth.module';
import { IngredientsModule } from './modules/ingredients/ingredients.module';
import { RecipesModule } from './modules/recipes/recipes.module';
import { SubmissionsModule } from './modules/submissions/submissions.module';
import { UploadsModule } from './modules/uploads/uploads.module';

@Module({
  imports: [
    PrismaModule,
    StorageModule,
    AuthModule,
    IngredientsModule,
    RecipesModule,
    SubmissionsModule,
    UploadsModule,
  ],
})
export class AppModule {}
