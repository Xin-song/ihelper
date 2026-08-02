import { IsISO8601, IsOptional } from 'class-validator';

/** 日历视图按可见范围查询，from/to 都不传就返回全部 */
export class FindEventsDto {
  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;
}
