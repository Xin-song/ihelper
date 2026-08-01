import { IsArray, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { INGREDIENT_CATEGORIES, IngredientCategory } from '@ihelper/shared';

export class CreateIngredientDto {
  @IsString()
  @MaxLength(100)
  name!: string;

  @IsIn(INGREDIENT_CATEGORIES)
  category!: IngredientCategory;

  @IsString()
  @MaxLength(20)
  defaultUnit!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  aliases?: string[];

  @IsOptional()
  @IsString()
  note?: string;
}
