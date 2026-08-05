import { inject, type InjectionKey, type Ref } from 'vue';
import type { CreateTaskInput, TaskDto, TaskTopicDto, UpdateTaskInput } from '@ihelper/shared';

/** 待办事项主题看板的共享状态与增删改操作，由 TaskTopicBoard 提供，各视图组件按需注入使用 */
export interface TaskBoardContext {
  topics: Ref<TaskTopicDto[]>;
  tasks: Ref<TaskDto[]>;
  loading: Ref<boolean>;
  createTopic: (name: string, color?: string) => Promise<void>;
  renameTopic: (topic: TaskTopicDto, name: string) => Promise<void>;
  deleteTopic: (topic: TaskTopicDto) => Promise<void>;
  createTask: (payload: CreateTaskInput) => Promise<void>;
  updateTask: (id: string, payload: UpdateTaskInput) => Promise<void>;
  deleteTask: (task: TaskDto) => Promise<void>;
}

export const TASK_BOARD_CONTEXT_KEY: InjectionKey<TaskBoardContext> = Symbol('task-board-context');

export function useTaskBoardContext(): TaskBoardContext {
  const ctx = inject(TASK_BOARD_CONTEXT_KEY);
  if (!ctx) throw new Error('useTaskBoardContext 必须在 TaskTopicBoard 内部使用');
  return ctx;
}

/** 「未分类」伪主题的 id，聚合 topicId 为 null 的待办事项 */
export const UNASSIGNED_TOPIC_ID = '__unassigned__';
