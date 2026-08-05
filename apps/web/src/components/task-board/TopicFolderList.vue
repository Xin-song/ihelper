<script setup lang="ts">
import { computed, reactive } from 'vue';
import { ElMessageBox } from 'element-plus';
import { ArrowDown, ArrowRight, Delete, Edit, Plus } from '@element-plus/icons-vue';
import type { TaskDto, TaskTopicDto } from '@ihelper/shared';
import { UNASSIGNED_TOPIC_ID, useTaskBoardContext } from './context';
import TaskRow from './TaskRow.vue';

const props = defineProps<{ mode: 'overview' | 'archived' }>();

const { topics, tasks, createTask, renameTopic, deleteTopic } = useTaskBoardContext();

interface FolderGroup {
  id: string;
  name: string;
  color: string | null;
  topic: TaskTopicDto | null;
}

const folders = computed<FolderGroup[]>(() => {
  const groups: FolderGroup[] = topics.value.map((t) => ({
    id: t.id,
    name: t.name,
    color: t.color,
    topic: t,
  }));
  const hasUnassigned = tasks.value.some((t) => t.topicId === null);
  if (hasUnassigned) {
    groups.push({ id: UNASSIGNED_TOPIC_ID, name: '未分类', color: null, topic: null });
  }
  return groups;
});

function tasksOf(folderId: string): TaskDto[] {
  const raw = tasks.value.filter((t) =>
    folderId === UNASSIGNED_TOPIC_ID ? t.topicId === null : t.topicId === folderId,
  );
  return props.mode === 'archived' ? raw.filter((t) => t.isArchived) : raw.filter((t) => !t.isArchived);
}

function pendingOf(folderId: string) {
  return tasksOf(folderId).filter((t) => t.status !== 'done');
}
function doneOf(folderId: string) {
  return tasksOf(folderId).filter((t) => t.status === 'done');
}

const collapsed = reactive(new Set<string>());
function toggle(id: string) {
  if (collapsed.has(id)) collapsed.delete(id);
  else collapsed.add(id);
}

const quickTitles = reactive<Record<string, string>>({});
async function quickAdd(folder: FolderGroup) {
  const title = (quickTitles[folder.id] ?? '').trim();
  if (!title) return;
  await createTask({ title, topicId: folder.topic ? folder.id : undefined });
  quickTitles[folder.id] = '';
}

async function handleRename(folder: FolderGroup) {
  if (!folder.topic) return;
  try {
    const { value } = await ElMessageBox.prompt('新的主题名称', '重命名主题', {
      inputValue: folder.name,
      confirmButtonText: '保存',
      cancelButtonText: '取消',
    });
    if (value && value.trim()) await renameTopic(folder.topic, value.trim());
  } catch {
    // 用户取消
  }
}

async function handleDelete(folder: FolderGroup) {
  if (!folder.topic) return;
  await deleteTopic(folder.topic);
}
</script>

<template>
  <div class="ih-topic-folders">
    <el-empty v-if="folders.length === 0" description="还没有主题，先新建一个吧" />
    <div v-for="folder in folders" :key="folder.id" class="ih-folder ih-card">
      <div class="ih-folder__header" @click="toggle(folder.id)">
        <el-icon><component :is="collapsed.has(folder.id) ? ArrowRight : ArrowDown" /></el-icon>
        <span
          class="ih-folder__dot"
          :style="{ background: folder.color ?? 'var(--ih-text-secondary)' }"
        />
        <span class="ih-folder__name">{{ folder.name }}</span>
        <span class="ih-muted">{{ tasksOf(folder.id).length }}</span>
        <div class="ih-folder__spacer" />
        <template v-if="folder.topic">
          <el-button text :icon="Edit" size="small" @click.stop="handleRename(folder)" />
          <el-button text :icon="Delete" size="small" @click.stop="handleDelete(folder)" />
        </template>
      </div>

      <div v-if="!collapsed.has(folder.id)" class="ih-folder__body">
        <template v-if="mode === 'overview'">
          <div v-if="folder.topic" class="ih-folder__quickadd">
            <el-input
              v-model="quickTitles[folder.id]"
              placeholder="快速添加待办，回车即可"
              maxlength="200"
              @keyup.enter="quickAdd(folder)"
            />
            <el-button :icon="Plus" circle @click="quickAdd(folder)" />
          </div>

          <div class="ih-folder__section-label">未完成 · {{ pendingOf(folder.id).length }}</div>
          <el-empty v-if="pendingOf(folder.id).length === 0" description="没有未完成的事项" :image-size="40" />
          <TaskRow v-for="t in pendingOf(folder.id)" :key="t.id" :task="t" />

          <template v-if="doneOf(folder.id).length > 0">
            <div class="ih-folder__section-label">已完成 · {{ doneOf(folder.id).length }}</div>
            <TaskRow v-for="t in doneOf(folder.id)" :key="t.id" :task="t" />
          </template>
        </template>

        <template v-else>
          <el-empty v-if="tasksOf(folder.id).length === 0" description="这个主题下还没有已归档的事项" :image-size="40" />
          <TaskRow v-for="t in tasksOf(folder.id)" :key="t.id" :task="t" />
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ih-topic-folders {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.ih-folder {
  padding: 14px 16px;
}

.ih-folder__header {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
}

.ih-folder__dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.ih-folder__name {
  font-weight: 700;
  font-size: 16px;
}

.ih-folder__spacer {
  flex: 1;
}

.ih-folder__body {
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ih-folder__quickadd {
  display: flex;
  gap: 8px;
  margin-bottom: 6px;
}

.ih-folder__section-label {
  font-size: 12px;
  font-weight: 700;
  color: var(--ih-text-secondary);
  margin-top: 6px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
</style>
