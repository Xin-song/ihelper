import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { SubmissionsService } from './submissions.service';
import { CreateSubmissionDto } from './dto/create-submission.dto';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentUser, RequestUser } from '../auth/decorators/current-user.decorator';

/** 作业广场：全局信息流 + 单条作业的互动 */
@Controller('submissions')
export class SubmissionsController {
  constructor(private readonly submissionsService: SubmissionsService) {}

  @Public()
  @Get()
  findFeed() {
    return this.submissionsService.findFeed();
  }

  /** 点赞是无身份的计数器，不需要登录，见 SubmissionsService 的注释 */
  @Public()
  @Post(':id/like')
  like(@Param('id') id: string) {
    return this.submissionsService.like(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.submissionsService.remove(id, user.id);
  }
}

/** 挂在菜谱下的作业：菜谱详情页的「交作业」和「用户作业」列表 */
@Controller('recipes/:recipeId/submissions')
export class RecipeSubmissionsController {
  constructor(private readonly submissionsService: SubmissionsService) {}

  @Public()
  @Get()
  findByRecipe(@Param('recipeId') recipeId: string) {
    return this.submissionsService.findByRecipe(recipeId);
  }

  @Post()
  create(
    @Param('recipeId') recipeId: string,
    @Body() dto: CreateSubmissionDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.submissionsService.create(recipeId, dto, user);
  }
}
