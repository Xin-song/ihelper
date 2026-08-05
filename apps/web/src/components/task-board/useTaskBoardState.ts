import { onMounted, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import type { CreateTaskInput, TaskDto, TaskTopicDto, UpdateTaskInput } from '@ihelper/shared';
import { taskTopicsApi } from '../../api/task-topics';
import { tasksApi } from '../../api/tasks';
import type { TaskBoardContext } from './context';

/**
 * 待办事项主题看板的共享状态：主题、待办事项都只拉一份，挂在 ScheduleView 顶层 provide 给
 * 「日历」「看板」「待办」「今日日程管理」「Archived」这几个同级 tab 共用，
 * 任意一个 tab 改了状态，其他 tab 读的是同一份响应式数据，天然同步。
 */
export function createTaskBoardState(): TaskBoardContext {
  const topics = ref<TaskTopicDto[]>([]);
  const tasks = ref<TaskDto[]>([]);
  const loading = ref(true);

  async function loadAll() {
    loading.value = true;
    try {
      const [topicList, taskList] = await Promise.all([taskTopicsApi.list(), tasksApi.list()]);
      topics.value = topicList;
      tasks.value = taskList;
    } catch (error) {
      ElMessage.error((error as Error).message);
    } finally {
      loading.value = false;
    }
  }

  async function createTopic(name: string, color?: string) {
    try {
      const created = await taskTopicsApi.create({ name, color });
      topics.value = [...topics.value, created];
    } catch (error) {
      ElMessage.error((error as Error).message);
    }
  }

  async function renameTopic(topic: TaskTopicDto, name: string) {
    try {
      const updated = await taskTopicsApi.update(topic.id, { name });
      const idx = topics.value.findIndex((t) => t.id === topic.id);
      if (idx !== -1) topics.value[idx] = updated;
    } catch (error) {
      ElMessage.error((error as Error).message);
    }
  }

  async function deleteTopic(topic: TaskTopicDto) {
    const count = tasks.value.filter((t) => t.topicId === topic.id).length;
    try {
      await ElMessageBox.confirm(
        count > 0
          ? `主题「${topic.name}」下有 ${count} 条待办事项，删除主题将一并删除它们，确定继续吗？`
          : `确定删除主题「${topic.name}」吗？`,
        '删除主题',
        { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' },
      );
    } catch {
      return;
    }
    try {
      await taskTopicsApi.remove(topic.id);
      topics.value = topics.value.filter((t) => t.id !== topic.id);
      tasks.value = tasks.value.filter((t) => t.topicId !== topic.id);
      ElMessage.success('已删除');
    } catch (error) {
      ElMessage.error((error as Error).message);
    }
  }

  async function createTask(payload: CreateTaskInput) {
    try {
      const created = await tasksApi.create(payload);
      tasks.value = [created, ...tasks.value];
    } catch (error) {
      ElMessage.error((error as Error).message);
    }
  }

  async function updateTask(id: string, payload: UpdateTaskInput) {
    try {
      const updated = await tasksApi.update(id, payload);
      const idx = tasks.value.findIndex((t) => t.id === id);
      if (idx !== -1) tasks.value[idx] = updated;
    } catch (error) {
      ElMessage.error((error as Error).message);
    }
  }

  async function deleteTask(task: TaskDto) {
    try {
      await ElMessageBox.confirm(`确定删除待办「${task.title}」吗？`, '删除待办', {
        type: 'warning',
        confirmButtonText: '删除',
        cancelButtonText: '取消',
      });
    } catch {
      return;
    }
    try {
      await tasksApi.remove(task.id);
      tasks.value = tasks.value.filter((t) => t.id !== task.id);
      ElMessage.success('已删除');
    } catch (error) {
      ElMessage.error((error as Error).message);
    }
  }

  onMounted(loadAll);

  return {
    topics,
    tasks,
    loading,
    createTopic,
    renameTopic,
    deleteTopic,
    createTask,
    updateTask,
    deleteTask,
  };
}
