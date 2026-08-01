import {
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  ValidateIf,
} from 'class-validator';
import { AMOUNT_TYPES, AmountType, VAGUE_AMOUNT_LABELS, VagueAmountLabel } from '@ihelper/shared';

export class RecipeIngredientDto {
  @IsUUID()
  ingredientId!: string;

  @IsIn(AMOUNT_TYPES)
  amountType!: AmountType;

  @ValidateIf((o: RecipeIngredientDto) => o.amountType === 'exact')
  @IsNumber()
  @IsPositive()
  quantity?: number;

  @ValidateIf((o: RecipeIngredientDto) => o.amountType === 'exact')
  @IsString()
  unit?: string;

  @ValidateIf((o: RecipeIngredientDto) => o.amountType === 'vague')
  @IsIn(VAGUE_AMOUNT_LABELS)
  vagueLabel?: VagueAmountLabel;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsBoolean()
  isOptional?: boolean;
}
