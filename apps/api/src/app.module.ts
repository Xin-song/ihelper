import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { StorageModule } from './storage/storage.module';
import { AuthModule } from './modules/auth/auth.module';
import { CalendarEventsModule } from './modules/calendar-events/calendar-events.module';
import { IngredientsModule } from './modules/ingredients/ingredients.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { RecipesModule } from './modules/recipes/recipes.module';
import { SubmissionsModule } from './modules/submissions/submissions.module';
import { TaskTopicsModule } from './modules/task-topics/task-topics.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { UploadsModule } from './modules/uploads/uploads.module';

@Module({
  imports: [
    PrismaModule,
    StorageModule,
    AuthModule,
    CalendarEventsModule,
    IngredientsModule,
    InventoryModule,
    RecipesModule,
    SubmissionsModule,
    TaskTopicsModule,
    TasksModule,
    UploadsModule,
  ],
})
export class AppModule {}
