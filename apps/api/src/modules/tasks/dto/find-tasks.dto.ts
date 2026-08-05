import { IsIn, IsISO8601, IsOptional, IsUUID } from 'class-validator';
import { TASK_STATUSES, TaskStatus } from '@ihelper/shared';

/** 日历视图按 dueAt 范围查询待办，待办 tab 按状态筛选，主题看板按 topicId 筛选，都是可选 query 参数 */
export class FindTasksDto {
  @IsOptional()
  @IsIn(TASK_STATUSES)
  status?: TaskStatus;

  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;

  @IsOptional()
  @IsUUID()
  topicId?: string;
}
