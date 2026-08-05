import { Module } from '@nestjs/common';
import { TaskTopicsController } from './task-topics.controller';
import { TaskTopicsService } from './task-topics.service';

@Module({
  controllers: [TaskTopicsController],
  providers: [TaskTopicsService],
})
export class TaskTopicsModule {}
