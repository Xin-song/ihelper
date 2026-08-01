import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { MAX_UPLOAD_FILES } from '@ihelper/shared';

export class CreateSubmissionDto {
  /** 至少一张成品图 —— 没有图的作业没有意义，DB 侧也有 CHECK 兜底 */
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_UPLOAD_FILES)
  images!: string[];

  /** 心得 / 经验 / 踩坑 */
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  body!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;
}
