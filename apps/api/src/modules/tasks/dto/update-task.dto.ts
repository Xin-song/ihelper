import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { TASK_PRIORITIES, TASK_STATUSES, TaskPriority, TaskStatus } from '@ihelper/shared';

/**
 * 不用 PartialType(CreateTaskDto)：topicId/scheduledStartAt/scheduledEndAt 需要同时接受
 * string（设置）、null（清空）、undefined（不改动）三态，和 CreateTaskDto 里「只能是 string」
 * 的类型不兼容，干脆显式写全部字段，避免子类型收窄报错。
 */
export class UpdateTaskDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  /** 传 null 表示移出当前主题（不分组），传 undefined 表示不改动 */
  @ValidateIf((_, value) => value !== null)
  @IsOptional()
  @IsUUID()
  topicId?: string | null;

  @IsOptional()
  @IsISO8601()
  dueAt?: string;

  @IsOptional()
  @IsIn(TASK_PRIORITIES)
  priority?: TaskPriority;

  @IsOptional()
  @IsIn(TASK_STATUSES)
  status?: TaskStatus;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(20)
  tags?: string[];

  /** true = 归档，false = 取消归档，见 TasksService 的 archivedAt 三态推导 */
  @IsOptional()
  @IsBoolean()
  archived?: boolean;

  /** 放入/移出「今日日程管理」时间轴，传 null 表示清空该字段 */
  @ValidateIf((_, value) => value !== null)
  @IsOptional()
  @IsISO8601()
  scheduledStartAt?: string | null;

  @ValidateIf((_, value) => value !== null)
  @IsOptional()
  @IsISO8601()
  scheduledEndAt?: string | null;
}
