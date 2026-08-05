<script setup lang="ts">
import { reactive, ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import type { TaskDto, TaskPriority } from '@ihelper/shared';
import { TASK_PRIORITIES, TASK_PRIORITY_LABELS } from '@ihelper/shared';
import { useTaskBoardContext } from './context';

const props = defineProps<{
  modelValue: boolean;
  task: TaskDto | null;
  defaultTopicId?: string | null;
}>();
const emit = defineEmits<{ 'update:modelValue': [boolean] }>();

const { topics, createTask, updateTask } = useTaskBoardContext();

const submitting = ref(false);
const form = reactive({
  title: '',
  description: '',
  topicId: '' as string | '',
  priority: 'medium' as TaskPriority,
  dueAt: null as Date | null,
  tags: [] as string[],
});

function resetForm() {
  if (props.task) {
    form.title = props.task.title;
    form.description = props.task.description ?? '';
    form.topicId = props.task.topicId ?? '';
    form.priority = props.task.priority;
    form.dueAt = props.task.dueAt ? new Date(props.task.dueAt) : null;
    form.tags = [...props.task.tags];
  } else {
    form.title = '';
    form.description = '';
    form.topicId = props.defaultTopicId ?? '';
    form.priority = 'medium';
    form.dueAt = null;
    form.tags = [];
  }
}

watch(() => props.modelValue, (visible) => {
  if (visible) resetForm();
});

async function submit() {
  if (!form.title.trim()) {
    ElMessage.warning('标题不能为空');
    return;
  }
  submitting.value = true;
  try {
    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      topicId: form.topicId || undefined,
      priority: form.priority,
      dueAt: form.dueAt ? form.dueAt.toISOString() : undefined,
      tags: form.tags,
    };
    if (props.task) {
      await updateTask(props.task.id, { ...payload, topicId: form.topicId || null });
    } else {
      await createTask(payload);
    }
    ElMessage.success('已保存');
    emit('update:modelValue', false);
  } finally {
    submitting.value = false;
  }
}
</script>


<template>
  <el-dialog
    :model-value="modelValue"
    :title="task ? '编辑待办事项' : '新建待办事项'"
    width="min(520px, 92vw)"
    @update:model-value="(v: boolean) => emit('update:modelValue', v)"
  >
    <el-form label-position="top">
      <el-form-item label="标题" required>
        <el-input v-model="form.title" maxlength="200" />
      </el-form-item>
      <el-form-item label="详情备注">
        <el-input v-model="form.description" type="textarea" :rows="3" maxlength="2000" placeholder="补充细节，方便以后回顾" />
      </el-form-item>
      <div class="ih-item-form__row">
        <el-form-item label="所属主题">
          <el-select v-model="form.topicId" style="width: 100%" clearable placeholder="不分组">
            <el-option v-for="t in topics" :key="t.id" :value="t.id" :label="t.name" />
          </el-select>
        </el-form-item>
        <el-form-item label="优先级">
          <el-select v-model="form.priority" style="width: 100%">
            <el-option v-for="p in TASK_PRIORITIES" :key="p" :value="p" :label="TASK_PRIORITY_LABELS[p]" />
          </el-select>
        </el-form-item>
      </div>
      <el-form-item label="截止时间">
        <el-date-picker v-model="form.dueAt" type="datetime" style="width: 100%" placeholder="不填表示无截止日期" />
      </el-form-item>
      <el-form-item label="标签">
        <el-select v-model="form.tags" multiple filterable allow-create default-first-option style="width: 100%" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button round @click="emit('update:modelValue', false)">取消</el-button>
      <el-button type="primary" round :loading="submitting" @click="submit">保存</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.ih-item-form__row {
  display: flex;
  gap: 16px;
}

.ih-item-form__row :deep(.el-form-item) {
  flex: 1;
}
</style>
