import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { SubmissionsService } from './submissions.service';
import { CreateSubmissionDto } from './dto/create-submission.dto';

/** 作业广场：全局信息流 + 单条作业的互动 */
@Controller('submissions')
export class SubmissionsController {
  constructor(private readonly submissionsService: SubmissionsService) {}

  @Get()
  findFeed() {
    return this.submissionsService.findFeed();
  }

  @Post(':id/like')
  like(@Param('id') id: string) {
    return this.submissionsService.like(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.submissionsService.remove(id);
  }
}

/** 挂在菜谱下的作业：菜谱详情页的「交作业」和「用户作业」列表 */
@Controller('recipes/:recipeId/submissions')
export class RecipeSubmissionsController {
  constructor(private readonly submissionsService: SubmissionsService) {}

  @Get()
  findByRecipe(@Param('recipeId') recipeId: string) {
    return this.submissionsService.findByRecipe(recipeId);
  }

  @Post()
  create(@Param('recipeId') recipeId: string, @Body() dto: CreateSubmissionDto) {
    return this.submissionsService.create(recipeId, dto);
  }
}
