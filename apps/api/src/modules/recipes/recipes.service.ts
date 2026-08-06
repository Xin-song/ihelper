import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { DEFAULT_SPACE_ID, RecipeSortOption, RecipeStep } from '@ihelper/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { LocalDiskStorage } from '../../storage/local-disk.storage';
import { CreateRecipeDto } from './dto/create-recipe.dto';
import { UpdateRecipeDto } from './dto/update-recipe.dto';
import { CreatePrintImageDto } from './dto/create-print-image.dto';
import { ListRecipesDto } from './dto/list-recipes.dto';

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
  createdAt: true,
  updatedAt: true,
  personalRating: true,
  lastCookedAt: true,
  authorId: true,
  author: AUTHOR_SELECT,
  /** 广场和列表页要显示「N 份作业」 */
  _count: { select: { submissions: { where: { deletedAt: null } } } },
} as const;

type ListedRecipe = Prisma.RecipeGetPayload<{ select: typeof LIST_SELECT }>;

const SORT_COMPARATORS: Record<RecipeSortOption, (a: ListedRecipe, b: ListedRecipe) => number> = {
  recent: (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  lastCooked: (a, b) => {
    if (!a.lastCookedAt && !b.lastCookedAt) return 0;
    if (!a.lastCookedAt) return 1;
    if (!b.lastCookedAt) return -1;
    return new Date(b.lastCookedAt).getTime() - new Date(a.lastCookedAt).getTime();
  },
  rating: (a, b) => (b.personalRating ?? -1) - (a.personalRating ?? -1),
  duration: (a, b) =>
    (a.prepMinutes ?? 0) + (a.cookMinutes ?? 0) - ((b.prepMinutes ?? 0) + (b.cookMinutes ?? 0)),
};

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
  async findAll(query: ListRecipesDto = {}) {
    const recipes = await this.findAndFilter({ spaceId: DEFAULT_SPACE_ID }, query);
    return recipes.map(serializeRecipe);
  }

  /**
   * 菜谱广场：只查公开的菜谱。
   * Phase 3 有多用户之前，这里查出来的只会是自己公开的那些；等 space 拆开后，
   * 这个方法要去掉 spaceId 过滤、改成跨空间查 public，其余不变。
   */
  async findPublic(query: ListRecipesDto = {}) {
    const recipes = await this.findAndFilter({ visibility: 'public' }, query);
    return recipes.map(serializeRecipe);
  }

  /**
   * 搜索与筛选，REQUIREMENTS.md 1.5。数据规模是个人/家庭菜谱（几十到几百道），
   * 分类/标签/难度这些能走 Prisma where 的先走 where；总耗时是两列相加、
   * 步骤关键词是 JSONB 全文，Prisma 表达不了，取回候选集后在应用层过滤/排序，
   * 不写原始 SQL，量级上完全跑得动。
   */
  private async findAndFilter(
    base: Prisma.RecipeWhereInput,
    query: ListRecipesDto,
  ): Promise<ListedRecipe[]> {
    const where = await this.buildWhere(base, query);
    let recipes = await this.prisma.recipe.findMany({ where, select: LIST_SELECT });

    recipes = this.applyDurationFilter(recipes, query.maxTotalMinutes);
    if (query.ingredientIds?.length) {
      recipes = await this.filterByIngredients(recipes, query.ingredientIds);
    }

    const compare = query.sortBy ? SORT_COMPARATORS[query.sortBy] : null;
    if (compare) recipes = [...recipes].sort(compare);
    else recipes = [...recipes].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    return recipes;
  }

  private async buildWhere(
    base: Prisma.RecipeWhereInput,
    query: ListRecipesDto,
  ): Promise<Prisma.RecipeWhereInput> {
    const where: Prisma.RecipeWhereInput = { ...base, deletedAt: null };
    if (query.category) where.category = query.category;
    if (query.tags?.length) where.tags = { hasSome: query.tags };
    if (query.difficulty) where.difficulty = query.difficulty;

    const keyword = query.keyword?.trim();
    if (keyword) {
      const stepsMatchIds = await this.findStepsMatchIds(keyword, base);
      where.OR = [
        { title: { contains: keyword, mode: 'insensitive' } },
        { description: { contains: keyword, mode: 'insensitive' } },
        ...(stepsMatchIds.length ? [{ id: { in: stepsMatchIds } }] : []),
      ];
    }
    return where;
  }

  /**
   * 步骤关键词匹配：steps 是 JSONB，search_vector 的 tsvector 又对中文分词不友好
   * （见 docs/DATABASE.md 已知限制），应用层直接对 JSON 文本做大小写不敏感的子串匹配兜底。
   */
  private async findStepsMatchIds(
    keyword: string,
    base: Prisma.RecipeWhereInput,
  ): Promise<string[]> {
    const rows = await this.prisma.recipe.findMany({
      where: { ...base, deletedAt: null },
      select: { id: true, steps: true },
    });
    const kw = keyword.toLowerCase();
    return rows.filter((r) => JSON.stringify(r.steps).toLowerCase().includes(kw)).map((r) => r.id);
  }

  /** 总耗时未知（准备/烹饪时长都没填）的菜谱在按耗时筛选时排除，而不是当成 0 分钟 */
  private applyDurationFilter(recipes: ListedRecipe[], maxTotalMinutes?: number): ListedRecipe[] {
    if (!maxTotalMinutes) return recipes;
    return recipes.filter((r) => {
      if (r.prepMinutes === null && r.cookMinutes === null) return false;
      return (r.prepMinutes ?? 0) + (r.cookMinutes ?? 0) <= maxTotalMinutes;
    });
  }

  /**
   * 食材反查：「冰箱里有这些食材，能做什么」——菜谱配料表里所有非可选项都在
   * 用户给的食材集合里就算「能做」，可选配料（比如「葱花，可选」）不参与判断；
   * 没配配料表的菜谱视为无法判断，不参与反查结果。
   */
  private async filterByIngredients(
    recipes: ListedRecipe[],
    ingredientIds: string[],
  ): Promise<ListedRecipe[]> {
    if (recipes.length === 0) return recipes;
    const links = await this.prisma.recipeIngredient.findMany({
      where: { recipeId: { in: recipes.map((r) => r.id) } },
      select: { recipeId: true, ingredientId: true, isOptional: true },
    });
    const have = new Set(ingredientIds);
    const requiredByRecipe = new Map<string, string[]>();
    for (const link of links) {
      if (link.isOptional) continue;
      const list = requiredByRecipe.get(link.recipeId) ?? [];
      list.push(link.ingredientId);
      requiredByRecipe.set(link.recipeId, list);
    }
    return recipes.filter((r) => {
      const required = requiredByRecipe.get(r.id);
      return !!required && required.length > 0 && required.every((id) => have.has(id));
    });
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
