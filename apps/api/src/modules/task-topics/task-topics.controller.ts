import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { TaskTopicsService } from './task-topics.service';
import { CreateTaskTopicDto } from './dto/create-task-topic.dto';
import { UpdateTaskTopicDto } from './dto/update-task-topic.dto';
import { CurrentUser, RequestUser } from '../auth/decorators/current-user.decorator';

/** 待办事项主题（看板文件夹）是私人数据，整个模块都要登录，按 userId 过滤，见 auth 模块的全局 Guard */
@Controller('task-topics')
export class TaskTopicsController {
  constructor(private readonly taskTopicsService: TaskTopicsService) {}

  @Get()
  findAll(@CurrentUser() user: RequestUser) {
    return this.taskTopicsService.findAll(user.id);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.taskTopicsService.findOne(id, user.id);
  }

  @Post()
  create(@Body() dto: CreateTaskTopicDto, @CurrentUser() user: RequestUser) {
    return this.taskTopicsService.create(dto, user.id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateTaskTopicDto, @CurrentUser() user: RequestUser) {
    return this.taskTopicsService.update(id, dto, user.id);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.taskTopicsService.remove(id, user.id);
  }
}
