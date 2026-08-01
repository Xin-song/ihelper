import { Module } from '@nestjs/common';
import { SubmissionsService } from './submissions.service';
import { RecipeSubmissionsController, SubmissionsController } from './submissions.controller';

@Module({
  controllers: [SubmissionsController, RecipeSubmissionsController],
  providers: [SubmissionsService],
})
export class SubmissionsModule {}
