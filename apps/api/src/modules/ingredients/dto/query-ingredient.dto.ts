import { IsOptional, IsString } from 'class-validator';

export class QueryIngredientDto {
  /** 匹配名称或别名（模糊），为空则返回全部 */
  @IsOptional()
  @IsString()
  query?: string;
}
