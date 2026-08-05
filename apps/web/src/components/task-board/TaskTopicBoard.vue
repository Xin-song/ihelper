<script setup lang="ts">
import { onMounted, provide, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus } from '@element-plus/icons-vue';
import type { CreateTaskInput, TaskDto, TaskTopicDto, UpdateTaskInput } from '@ihelper/shared';
import { taskTopicsApi } from '../../api/task-topics';
import { tasksApi } from '../../api/tasks';
import { TASK_BOARD_CONTEXT_KEY } from './context';
import TodayScheduleBoard from './TodayScheduleBoard.vue';
import TopicFolderList from './TopicFolderList.vue';

const subView = ref<'today' | 'overview' | 'archived'>('today');

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

provide(TASK_BOARD_CONTEXT_KEY, {
  topics,
  tasks,
  loading,
  createTopic,
  renameTopic,
  deleteTopic,
  createTask,
  updateTask,
  deleteTask,
});

/* ---------- 新建主题弹窗 ---------- */
const newTopicVisible = ref(false);
const newTopicForm = reactive({ name: '', color: '#e2622c' });
async function submitNewTopic() {
  if (!newTopicForm.name.trim()) {
    ElMessage.warning('主题名称不能为空');
    return;
  }
  await createTopic(newTopicForm.name.trim(), newTopicForm.color);
  newTopicVisible.value = false;
  newTopicForm.name = '';
}

onMounted(loadAll);
</script>

<template>
  <div class="ih-task-board">
    <div class="ih-task-board__toolbar">
      <el-radio-group v-model="subView" size="default">
        <el-radio-button label="today">今日日程管理</el-radio-button>
        <el-radio-button label="overview">待办事项总览</el-radio-button>
        <el-radio-button label="archived">Archived</el-radio-button>
      </el-radio-group>
      <el-button type="primary" round :icon="Plus" @click="newTopicVisible = true">新建主题</el-button>
    </div>

    <div v-if="loading" class="ih-task-board__loading">
      <div v-for="i in 3" :key="i" class="ih-skeleton ih-card"></div>
    </div>
    <template v-else>
      <TodayScheduleBoard v-if="subView === 'today'" />
      <TopicFolderList v-else-if="subView === 'overview'" mode="overview" />
      <TopicFolderList v-else mode="archived" />
    </template>

    <el-dialog v-model="newTopicVisible" title="新建主题" width="min(420px, 92vw)">
      <el-form label-position="top">
        <el-form-item label="主题名称" required>
          <el-input v-model="newTopicForm.name" maxlength="100" @keyup.enter="submitNewTopic" />
        </el-form-item>
        <el-form-item label="强调色">
          <el-color-picker v-model="newTopicForm.color" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button round @click="newTopicVisible = false">取消</el-button>
        <el-button type="primary" round @click="submitNewTopic">创建</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.ih-task-board__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 18px;
}

.ih-task-board__loading {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.ih-skeleton {
  height: 56px;
  background: linear-gradient(100deg, #f3ede3 30%, #efe6d9 50%, #f3ede3 70%);
  background-size: 200% 100%;
  animation: ih-shimmer 1.4s ease-in-out infinite;
}

@keyframes ih-shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}
</style>
