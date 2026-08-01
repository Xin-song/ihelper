import { Injectable, NotFoundException } from '@nestjs/common';
import { DEFAULT_SPACE_ID } from '@ihelper/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateSubmissionDto } from './dto/create-submission.dto';

const SUBMISSION_SELECT = {
  id: true,
  recipeId: true,
  authorName: true,
  images: true,
  body: true,
  rating: true,
  likeCount: true,
  createdAt: true,
} as const;

/** 作业广场要显示「做的是哪道菜」，按菜谱查时不需要（页面上下文已经有了） */
const WITH_RECIPE = {
  recipe: { select: { id: true, title: true, coverImageUrl: true } },
} as const;

@Injectable()
export class SubmissionsService {
  constructor(private readonly prisma: PrismaService) {}

  /** 作业广场的全局信息流 */
  async findFeed(limit = 50) {
    return this.prisma.recipeSubmission.findMany({
      where: { spaceId: DEFAULT_SPACE_ID, deletedAt: null },
      select: { ...SUBMISSION_SELECT, ...WITH_RECIPE },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /** 某道菜下面的所有作业，菜谱详情页「用户作业」用 */
  async findByRecipe(recipeId: string) {
    await this.assertRecipeExists(recipeId);
    return this.prisma.recipeSubmission.findMany({
      where: { recipeId, deletedAt: null },
      select: SUBMISSION_SELECT,
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(recipeId: string, dto: CreateSubmissionDto) {
    await this.assertRecipeExists(recipeId);
    return this.prisma.recipeSubmission.create({
      data: {
        spaceId: DEFAULT_SPACE_ID,
        recipeId,
        images: dto.images,
        body: dto.body,
        rating: dto.rating,
        authorName: dto.authorName?.trim() || '我',
      },
      select: SUBMISSION_SELECT,
    });
  }

  /** 点赞。先做最简单的计数器，Phase 3 有用户后再拆成关联表以支持取消赞 */
  async like(id: string) {
    await this.assertExists(id);
    return this.prisma.recipeSubmission.update({
      where: { id },
      data: { likeCount: { increment: 1 } },
      select: SUBMISSION_SELECT,
    });
  }

  async remove(id: string) {
    await this.assertExists(id);
    return this.prisma.recipeSubmission.update({
      where: { id },
      data: { deletedAt: new Date() },
      select: { id: true },
    });
  }

  private async assertExists(id: string) {
    const found = await this.prisma.recipeSubmission.findFirst({
      where: { id, spaceId: DEFAULT_SPACE_ID, deletedAt: null },
      select: { id: true },
    });
    if (!found) throw new NotFoundException(`作业 ${id} 不存在`);
  }

  private async assertRecipeExists(recipeId: string) {
    const found = await this.prisma.recipe.findFirst({
      where: { id: recipeId, spaceId: DEFAULT_SPACE_ID, deletedAt: null },
      select: { id: true },
    });
    if (!found) throw new NotFoundException(`菜谱 ${recipeId} 不存在`);
  }
}
