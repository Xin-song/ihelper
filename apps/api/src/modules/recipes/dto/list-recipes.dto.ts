import { Transform } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { RECIPE_SORT_OPTIONS, RecipeSortOption } from '@ihelper/shared';

/** 查询参数里的数组：既接受真数组（重复 key），也接受逗号拼接的单个字符串，两边都兜住 */
function toArray({ value }: { value: unknown }): string[] | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (Array.isArray(value)) return value as string[];
  return String(value)
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

function toNumber({ value }: { value: unknown }): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  return Number(value);
}

/** 菜谱搜索/筛选查询参数，REQUIREMENTS.md 1.5，「我的菜谱」和「菜谱广场」共用 */
export class ListRecipesDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  keyword?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  category?: string;

  @IsOptional()
  @Transform(toArray)
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(1)
  @Max(5)
  difficulty?: number;

  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(1)
  maxTotalMinutes?: number;

  @IsOptional()
  @IsIn(RECIPE_SORT_OPTIONS)
  sortBy?: RecipeSortOption;

  /** 食材反查：「我有这些食材，能做什么」，见 RecipesService.filterByIngredients */
  @IsOptional()
  @Transform(toArray)
  @IsArray()
  @IsUUID('4', { each: true })
  ingredientIds?: string[];
}
