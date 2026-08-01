<script setup lang="ts">
import { reactive, ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import type { SubmissionDto } from '@ihelper/shared';
import { submissionsApi } from '../api/submissions';
import { useAuthStore } from '../stores/auth';
import ImageUploader from './ImageUploader.vue';

const props = defineProps<{ modelValue: boolean; recipeId: string; recipeTitle: string }>();
const emit = defineEmits<{
  'update:modelValue': [boolean];
  created: [SubmissionDto];
}>();

const authStore = useAuthStore();
const submitting = ref(false);

const form = reactive({
  images: [] as string[],
  body: '',
  rating: 0,
});

function reset() {
  form.images = [];
  form.body = '';
  form.rating = 0;
}

// 每次重新打开都从空白开始，避免上次没提交的内容残留
watch(
  () => props.modelValue,
  (open) => {
    if (open) reset();
  },
);

async function submit() {
  if (form.images.length === 0) {
    ElMessage.warning('至少传一张成品图');
    return;
  }
  if (form.body.trim() === '') {
    ElMessage.warning('写点做的过程或心得吧');
    return;
  }

  submitting.value = true;
  try {
    const created = await submissionsApi.create(props.recipeId, {
      images: form.images,
      body: form.body.trim(),
      // el-rate 没选时是 0，后端只认 1-5，所以要转成不传
      rating: form.rating > 0 ? form.rating : undefined,
    });
    emit('created', created);
    emit('update:modelValue', false);
    ElMessage.success('作业已提交');
  } catch (error) {
    ElMessage.error((error as Error).message);
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    :title="`交作业 · ${recipeTitle}`"
    width="min(560px, 92vw)"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <el-form label-position="top">
      <el-form-item label="成品图" required>
        <ImageUploader
          v-model="form.images"
          :max="9"
          hint="最多 9 张，第一张会作为封面"
        />
      </el-form-item>

      <el-form-item label="做的过程 / 心得 / 踩了什么坑" required>
        <el-input
          v-model="form.body"
          type="textarea"
          :rows="5"
          maxlength="2000"
          show-word-limit
          placeholder="比如：糖放多了下次减半；番茄要炒出沙再下蛋"
        />
      </el-form-item>

      <div class="ih-submission-form__row">
        <el-form-item label="给这道菜打个分">
          <el-rate
            v-model="form.rating"
            :colors="['#e2622c', '#e2622c', '#e2622c']"
            void-color="#ece2d6"
            clearable
          />
        </el-form-item>

        <el-form-item label="署名">
          <span class="ih-submission-form__author">{{ authStore.user?.displayName }}</span>
        </el-form-item>
      </div>
    </el-form>

    <template #footer>
      <el-button round @click="emit('update:modelValue', false)">取消</el-button>
      <el-button type="primary" round :loading="submitting" @click="submit">提交作业</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.ih-submission-form__row {
  display: flex;
  gap: 24px;
  flex-wrap: wrap;
}

.ih-submission-form__row :deep(.el-form-item) {
  flex: 1;
  min-width: 180px;
}

.ih-submission-form__author {
  font-size: 14px;
  color: var(--ih-text-secondary);
}
</style>
