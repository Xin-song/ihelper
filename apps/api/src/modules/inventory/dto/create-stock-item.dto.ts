import { IsIn, IsNumber, IsOptional, IsString, Min, MaxLength, MinLength } from 'class-validator';
import { INGREDIENT_CATEGORIES, IngredientCategory } from '@ihelper/shared';

export class CreateStockItemDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @IsIn(INGREDIENT_CATEGORIES)
  category!: IngredientCategory;

  @IsNumber()
  @Min(0)
  quantity!: number;

  @IsString()
  @MinLength(1)
  @MaxLength(20)
  unit!: string;

  /** 低于这个值就进采购清单；不传表示不设阈值 */
  @IsOptional()
  @IsNumber()
  @Min(0)
  safetyStock?: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  note?: string;
}
