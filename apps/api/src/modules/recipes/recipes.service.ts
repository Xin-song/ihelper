import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DEFAULT_SPACE_ID, RecipeStep } from '@ihelper/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { LocalDiskStorage } from '../../storage/local-disk.storage';
import { CreateRecipeDto } from './dto/create-recipe.dto';
import { UpdateRecipeDto } from './dto/update-recipe.dto';
import { CreatePrintImageDto } from './dto/create-print-image.dto';

const AUTHOR_SELECT = { select: { id: true, username: true, displayName: true } } as const;

const LIST_SELECT = {
  id: true,
  title: true,
  coverImageUrl: true,
  description: true,
  category: true,
  tags: true,
  prepMinutes: true,
  cookMinutes: true,
  difficulty: true,
  servings: true,
  visibility: true,
  updatedAt: true,
  authorId: true,
  author: AUTHOR_SELECT,
  /** 广场和列表页要显示「N 份作业」 */
  _count: { select: { submissions: { where: { deletedAt: null } } } },
} as const;

const DETAIL_INCLUDE = {
  author: AUTHOR_SELECT,
  recipeIngredients: {
    orderBy: { sortOrder: 'asc' as const },
    include: {
      ingredient: {
        select: { id: true, name: true, defaultUnit: true, category: true },
      },
    },
  },
  printImages: {
    orderBy: [{ sortOrder: 'asc' as const }, { createdAt: 'asc' as const }],
  },
};

function toSteps(steps: { body: string; imageUrl?: string; timerSeconds?: number }[]): RecipeStep[] {
  return steps.map((step, index) => ({
    stepNumber: index + 1,
    body: step.body,
    imageUrl: step.imageUrl,
    timerSeconds: step.timerSeconds,
  }));
}

/** Prisma 的 Decimal 字段（servings / quantity）序列化成 JSON 时默认是字符串，这里统一转成 number */
function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  return typeof value === 'object' && 'toNumber' in (value as object)
    ? (value as { toNumber(): number }).toNumber()
    : Number(value);
}

type WithServings = { servings: unknown };
type WithRecipeIngredients = { recipeIngredients?: Array<{ quantity: unknown }> };
type WithCount = { _count?: { submissions: number } };

function serializeRecipe<T extends WithServings & WithRecipeIngredients & WithCount>(recipe: T) {
  // _count 是 Prisma 的内部形状，不该漏到 API 上，拆出来换成 submissionCount
  const { _count, ...rest } = recipe;
  return {
    ...rest,
    servings: toNumber(recipe.servings),
    submissionCount: _count?.submissions,
    recipeIngredients: recipe.recipeIngredients?.map((ri) => ({
      ...ri,
      quantity: toNumber(ri.quantity),
    })),
  };
}

@Injectable()
export class RecipesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: LocalDiskStorage,
  ) {}

  /** 我的菜谱：本空间全部，不分公开与否 */
  async findAll() {
    const recipes = await this.prisma.recipe.findMany({
      where: { spaceId: DEFAULT_SPACE_ID, deletedAt: null },
      select: LIST_SELECT,
      orderBy: { updatedAt: 'desc' },
    });
    return recipes.map(serializeRecipe);
  }

  /**
   * 菜谱广场：只查公开的菜谱。
   * Phase 3 有多用户之前，这里查出来的只会是自己公开的那些；等 space 拆开后，
   * 这个方法要去掉 spaceId 过滤、改成跨空间查 public，其余不变。
   */
  async findPublic() {
    const recipes = await this.prisma.recipe.findMany({
      where: { visibility: 'public', deletedAt: null },
      select: LIST_SELECT,
      orderBy: { updatedAt: 'desc' },
    });
    return recipes.map(serializeRecipe);
  }

  async findOne(id: string) {
    const recipe = await this.prisma.recipe.findFirst({
      where: { id, spaceId: DEFAULT_SPACE_ID, deletedAt: null },
      include: DETAIL_INCLUDE,
    });
    if (!recipe) {
      throw new NotFoundException(`菜谱 ${id} 不存在`);
    }
    return serializeRecipe(recipe);
  }

  async create(dto: CreateRecipeDto, authorId: string) {
    const recipe = await this.prisma.$transaction(async (tx) => {
      const created = await tx.recipe.create({
        data: {
          spaceId: DEFAULT_SPACE_ID,
          authorId,
          title: dto.title,
          coverImageUrl: dto.coverImageUrl,
          description: dto.description,
          category: dto.category,
          tags: dto.tags ?? [],
          steps: toSteps(dto.steps) as unknown as object,
          prepMinutes: dto.prepMinutes,
          cookMinutes: dto.cookMinutes,
          difficulty: dto.difficulty,
          servings: dto.servings,
          source: dto.source,
          visibility: dto.visibility ?? 'private',
        },
      });

      if (dto.ingredients.length > 0) {
        await tx.recipeIngredient.createMany({
          data: dto.ingredients.map((ing, index) => ({
            recipeId: created.id,
            ingredientId: ing.ingredientId,
            amountType: ing.amountType,
            quantity: ing.quantity,
            unit: ing.unit,
            vagueLabel: ing.vagueLabel,
            note: ing.note,
            isOptional: ing.isOptional ?? false,
            sortOrder: index,
          })),
        });
      }

      return created;
    });

    return this.findOne(recipe.id);
  }

  async update(id: string, dto: UpdateRecipeDto, userId: string) {
    const existing = await this.findOne(id);
    this.assertOwnership(existing, userId);

    await this.prisma.$transaction(async (tx) => {
      await tx.recipe.update({
        where: { id },
        data: {
          title: dto.title,
          coverImageUrl: dto.coverImageUrl,
          description: dto.description,
          category: dto.category,
          tags: dto.tags,
          steps: dto.steps ? (toSteps(dto.steps) as unknown as object) : undefined,
          prepMinutes: dto.prepMinutes,
          cookMinutes: dto.cookMinutes,
          difficulty: dto.difficulty,
          servings: dto.servings,
          source: dto.source,
          visibility: dto.visibility,
        },
      });

      if (dto.ingredients) {
        await tx.recipeIngredient.deleteMany({ where: { recipeId: id } });
        if (dto.ingredients.length > 0) {
          await tx.recipeIngredient.createMany({
            data: dto.ingredients.map((ing, index) => ({
              recipeId: id,
              ingredientId: ing.ingredientId,
              amountType: ing.amountType,
              quantity: ing.quantity,
              unit: ing.unit,
              vagueLabel: ing.vagueLabel,
              note: ing.note,
              isOptional: ing.isOptional ?? false,
              sortOrder: index,
            })),
          });
        }
      }
    });

    return this.findOne(id);
  }

  async remove(id: string, userId: string) {
    const existing = await this.findOne(id);
    this.assertOwnership(existing, userId);
    return this.prisma.recipe.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  /** 挂一张已上传的打印版菜谱图到菜谱上 */
  async addPrintImage(recipeId: string, dto: CreatePrintImageDto, userId: string) {
    const recipe = await this.findOne(recipeId);
    this.assertOwnership(recipe, userId);
    const last = await this.prisma.recipePrintImage.findFirst({
      where: { recipeId },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });
    return this.prisma.recipePrintImage.create({
      data: {
        recipeId,
        url: dto.url,
        orientation: dto.orientation,
        sortOrder: (last?.sortOrder ?? -1) + 1,
      },
    });
  }

  /**
   * 打印版图是硬删除：它没有软删除字段，也没有引用它的东西。
   * 文件本身也一起删，否则 uploads 目录只涨不减。
   */
  async removePrintImage(recipeId: string, imageId: string, userId: string) {
    const recipe = await this.findOne(recipeId);
    this.assertOwnership(recipe, userId);
    const image = await this.prisma.recipePrintImage.findFirst({
      where: { id: imageId, recipeId },
    });
    if (!image) {
      throw new NotFoundException(`打印版图 ${imageId} 不存在`);
    }

    await this.prisma.recipePrintImage.delete({ where: { id: imageId } });

    const key = this.storage.keyFromUrl(image.url);
    if (key) await this.storage.remove(key);

    return { id: imageId };
  }

  /** authorId 为空是登录接入前建的存量菜谱，暂不限制谁能改；见 ARCHITECTURE.md 4.4 */
  private assertOwnership(recipe: { authorId: string | null }, userId: string) {
    if (recipe.authorId && recipe.authorId !== userId) {
      throw new ForbiddenException('无权修改他人创建的菜谱');
    }
  }
}
