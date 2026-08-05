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

/** 待办，REQUIREMENTS.md 3.1（子任务=主题下的待办事项本身，不做更深一层嵌套） */
export interface TaskDto {
  id: string;
  title: string;
  description: string | null;
  /** 所属主题（待办事项主题看板的「文件夹」），null 表示未分组 */
  topicId: string | null;
  dueAt: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  tags: string[];
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** 派生字段：有截止时间、未完成/取消、且已过期 */
  isOverdue: boolean;
  archivedAt: string | null;
  /** 派生字段：archivedAt !== null */
  isArchived: boolean;
  /** 放入「今日日程管理」时间轴的起止时间，两者同时为空表示未放入时间轴 */
  scheduledStartAt: string | null;
  scheduledEndAt: string | null;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  topicId?: string;
  dueAt?: string;
  priority?: TaskPriority;
  status?: TaskStatus;
  tags?: string[];
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  /** 传 null 移出当前主题，传 undefined 不改动 */
  topicId?: string | null;
  dueAt?: string;
  priority?: TaskPriority;
  status?: TaskStatus;
  tags?: string[];
  /** true 归档 / false 取消归档 */
  archived?: boolean;
  /** 传 null 清空（移出今日日程时间轴） */
  scheduledStartAt?: string | null;
  scheduledEndAt?: string | null;
}

/** 待办事项主题（主题看板的「文件夹」），REQUIREMENTS.md 3.1「所属项目/清单」的落地 */
export interface TaskTopicDto {
  id: string;
  name: string;
  color: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaskTopicInput {
  name: string;
  color?: string;
}

export interface UpdateTaskTopicInput {
  name?: string;
  color?: string;
  sortOrder?: number;
}

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
