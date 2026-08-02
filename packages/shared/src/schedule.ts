/**
 * 待办与日程模块的应用层枚举常量与共用类型，REQUIREMENTS.md 3.1/3.2。
 * 和 recipe.ts 一样：数据库里这些字段是 TEXT，不用 Postgres enum，合法值校验放在这一层。
 */

export const TASK_STATUSES = ['todo', 'in_progress', 'done', 'cancelled'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  todo: '待开始',
  in_progress: '进行中',
  done: '已完成',
  cancelled: '已取消',
};

export const TASK_PRIORITIES = ['low', 'medium', 'high'] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: '低',
  medium: '中',
  high: '高',
};

/** 待办，REQUIREMENTS.md 3.1（最小版：不含子任务、重复规则、系统生成溯源） */
export interface TaskDto {
  id: string;
  title: string;
  description: string | null;
  dueAt: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  tags: string[];
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** 派生字段：有截止时间、未完成/取消、且已过期 */
  isOverdue: boolean;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  dueAt?: string;
  priority?: TaskPriority;
  status?: TaskStatus;
  tags?: string[];
}

export type UpdateTaskInput = Partial<CreateTaskInput>;

/** 纯日程事件（有起止时间、无完成状态），REQUIREMENTS.md 3.2 */
export interface CalendarEventDto {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  startAt: string;
  endAt: string;
  allDay: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEventInput {
  title: string;
  description?: string;
  location?: string;
  startAt: string;
  endAt: string;
  allDay?: boolean;
}

export type UpdateEventInput = Partial<CreateEventInput>;
