<script setup lang="ts">
import { ref } from 'vue';
import { Delete, FolderOpened, MoreFilled } from '@element-plus/icons-vue';
import type { TaskDto } from '@ihelper/shared';
import { TASK_PRIORITY_LABELS } from '@ihelper/shared';
import { useTaskBoardContext } from './context';
import TaskEditDialog from './TaskEditDialog.vue';

const props = defineProps<{
  task: TaskDto;
}>();

const { updateTask, deleteTask } = useTaskBoardContext();

const detailsExpanded = ref(false);
const editVisible = ref(false);

function toggleDone(checked: boolean) {
  updateTask(props.task.id, { status: checked ? 'done' : 'todo' });
}

function toggleArchived(archived: boolean) {
  updateTask(props.task.id, { archived });
}

const draftDescription = ref('');
function openDetails() {
  draftDescription.value = props.task.description ?? '';
  detailsExpanded.value = !detailsExpanded.value;
}
function saveDetails() {
  updateTask(props.task.id, { description: draftDescription.value.trim() || undefined });
  detailsExpanded.value = false;
}
</script>

<template>
  <div class="ih-tb-row ih-card" :class="{ 'ih-tb-row--done': task.status === 'done' }">
    <div class="ih-tb-row__main">
      <el-checkbox
        :model-value="task.status === 'done'"
        size="large"
        @change="toggleDone($event as boolean)"
      />
      <span class="ih-tb-row__title" @click="editVisible = true">{{ task.title }}</span>
      <span class="ih-chip" :class="`ih-chip--priority-${task.priority}`">{{ TASK_PRIORITY_LABELS[task.priority] }}</span>
      <span v-for="tag in task.tags" :key="tag" class="ih-chip ih-chip--muted">{{ tag }}</span>
      <span v-if="task.dueAt" class="ih-muted ih-tb-row__due" :class="{ 'ih-tb-row__due--overdue': task.isOverdue }">
        {{ new Date(task.dueAt).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) }}
      </span>

      <el-button text size="small" @click="openDetails">详情</el-button>
      <el-dropdown trigger="click">
        <el-button text :icon="MoreFilled" />
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item @click="editVisible = true">编辑</el-dropdown-item>
            <el-dropdown-item v-if="!task.isArchived" :icon="FolderOpened" @click="toggleArchived(true)">归档</el-dropdown-item>
            <el-dropdown-item v-else :icon="FolderOpened" @click="toggleArchived(false)">取消归档</el-dropdown-item>
            <el-dropdown-item :icon="Delete" divided @click="deleteTask(task)">删除</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>

    <div v-if="detailsExpanded" class="ih-tb-row__details">
      <el-input
        v-model="draftDescription"
        type="textarea"
        :rows="2"
        maxlength="2000"
        placeholder="补充细节，方便以后回顾"
      />
      <div class="ih-tb-row__details-actions">
        <el-button size="small" round @click="detailsExpanded = false">取消</el-button>
        <el-button size="small" type="primary" round @click="saveDetails">保存</el-button>
      </div>
    </div>

    <TaskEditDialog v-model="editVisible" :task="task" />
  </div>
</template>

<style scoped>
.ih-tb-row {
  padding: 10px 14px;
}

.ih-tb-row__main {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.ih-tb-row--done .ih-tb-row__title {
  text-decoration: line-through;
  color: var(--ih-text-secondary);
}

.ih-tb-row__title {
  font-weight: 600;
  font-size: 15px;
  cursor: pointer;
  flex: 1;
  min-width: 100px;
}

.ih-chip--priority-high {
  background: #f6dede;
  color: #c45c5c;
}

.ih-chip--priority-low {
  background: #f1ede6;
  color: var(--ih-text-secondary);
}

.ih-tb-row__due {
  font-size: 12px;
  white-space: nowrap;
}

.ih-tb-row__due--overdue {
  color: #c45c5c;
  font-weight: 600;
}

.ih-tb-row__details {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px dashed var(--ih-border);
}

.ih-tb-row__details-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 8px;
}
</style>
