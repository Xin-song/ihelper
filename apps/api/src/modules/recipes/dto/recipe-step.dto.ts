import { IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class RecipeStepDto {
  @IsString()
  @MinLength(1)
  body!: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  timerSeconds?: number;
}
