<script setup lang="ts">
import { computed, ref } from 'vue';
import { ElMessage } from 'element-plus';
import type { SubmissionDto } from '@ihelper/shared';
import { submissionsApi } from '../api/submissions';
import { useAuthStore } from '../stores/auth';

const props = withDefaults(
  defineProps<{
    submission: SubmissionDto;
    /** 作业广场里要显示「做的是哪道菜」，菜谱详情页里不用 */
    showRecipe?: boolean;
  }>(),
  { showRecipe: false },
);

const emit = defineEmits<{ removed: [string] }>();

const authStore = useAuthStore();
const likeCount = ref(props.submission.likeCount);
const liking = ref(false);

/** 没 userId 是登录接入前的存量作业，登录用户都能删；有 userId 的只有本人能删 */
const canRemove = computed(() => {
  if (!authStore.user) return false;
  return !props.submission.userId || props.submission.userId === authStore.user.id;
});

const createdAt = computed(() =>
  new Date(props.submission.createdAt).toLocaleDateString('zh-CN', {
    month: 'long',
    day: 'numeric',
  }),
);

/** 九宫格布局：1 张铺满，2-4 张两列，更多用三列 */
const gridColumns = computed(() => {
  const n = props.submission.images.length;
  if (n === 1) return 1;
  if (n <= 4) return 2;
  return 3;
});

async function like() {
  liking.value = true;
  try {
    const updated = await submissionsApi.like(props.submission.id);
    likeCount.value = updated.likeCount;
  } catch (error) {
    ElMessage.error((error as Error).message);
  } finally {
    liking.value = false;
  }
}

async function remove() {
  try {
    await submissionsApi.remove(props.submission.id);
    ElMessage.success('已删除');
    emit('removed', props.submission.id);
  } catch (error) {
    ElMessage.error((error as Error).message);
  }
}
</script>

<template>
  <article class="ih-submission ih-card">
    <header class="ih-submission__head">
      <div class="ih-submission__avatar">{{ submission.authorName.slice(0, 1) }}</div>
      <div class="ih-submission__who">
        <span class="ih-submission__author">{{ submission.authorName }}</span>
        <span class="ih-muted ih-submission__time">{{ createdAt }}</span>
      </div>
      <el-rate
        v-if="submission.rating"
        :model-value="submission.rating"
        disabled
        size="small"
        :colors="['#e2622c', '#e2622c', '#e2622c']"
        void-color="#ece2d6"
      />
    </header>

    <RouterLink
      v-if="showRecipe && submission.recipe"
      :to="`/recipes/${submission.recipe.id}`"
      class="ih-submission__recipe"
    >
      <img v-if="submission.recipe.coverImageUrl" :src="submission.recipe.coverImageUrl" alt="" />
      <span v-else class="ih-submission__recipe-placeholder">🍳</span>
      <span class="ih-submission__recipe-title">跟着「{{ submission.recipe.title }}」做的</span>
    </RouterLink>

    <p class="ih-submission__body">{{ submission.body }}</p>

    <div
      class="ih-submission__images"
      :style="{ gridTemplateColumns: `repeat(${gridColumns}, 1fr)` }"
    >
      <a
        v-for="url in submission.images"
        :key="url"
        :href="url"
        target="_blank"
        rel="noopener"
        class="ih-submission__image"
        :class="{ 'ih-submission__image--single': submission.images.length === 1 }"
      >
        <img :src="url" alt="成品图" loading="lazy" />
      </a>
    </div>

    <footer class="ih-submission__foot">
      <button type="button" class="ih-submission__like" :disabled="liking" @click="like">
        <span class="ih-submission__like-icon">👏</span>
        {{ likeCount > 0 ? likeCount : '赞一个' }}
      </button>
      <el-popconfirm
        v-if="canRemove"
        title="删除这条作业？"
        confirm-button-text="删除"
        cancel-button-text="取消"
        @confirm="remove"
      >
        <template #reference>
          <button type="button" class="ih-submission__delete ih-muted">删除</button>
        </template>
      </el-popconfirm>
    </footer>
  </article>
</template>

<style scoped>
.ih-submission {
  padding: 18px 20px 14px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.ih-submission__head {
  display: flex;
  align-items: center;
  gap: 10px;
}

.ih-submission__avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--ih-primary-light);
  color: var(--ih-primary-dark);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 15px;
  flex-shrink: 0;
}

.ih-submission__who {
  display: flex;
  flex-direction: column;
  margin-right: auto;
  min-width: 0;
}

.ih-submission__author {
  font-weight: 600;
  font-size: 14px;
}

.ih-submission__time {
  font-size: 12px;
}

.ih-submission__recipe {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px 6px 6px;
  border-radius: 999px;
  background: #f1ede6;
  text-decoration: none;
  color: var(--ih-text-secondary);
  font-size: 13px;
  align-self: flex-start;
  max-width: 100%;
}

.ih-submission__recipe:hover {
  background: var(--ih-primary-light);
  color: var(--ih-primary-dark);
}

.ih-submission__recipe img,
.ih-submission__recipe-placeholder {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  object-fit: cover;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--ih-primary-light);
  font-size: 13px;
  flex-shrink: 0;
}

.ih-submission__recipe-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ih-submission__body {
  margin: 0;
  line-height: 1.75;
  font-size: 14px;
  white-space: pre-wrap;
}

.ih-submission__images {
  display: grid;
  gap: 6px;
}

.ih-submission__image {
  display: block;
  aspect-ratio: 1;
  border-radius: var(--ih-radius-sm);
  overflow: hidden;
  background: var(--ih-primary-light);
}

.ih-submission__image--single {
  aspect-ratio: 4 / 3;
  max-width: 420px;
}

.ih-submission__image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.ih-submission__foot {
  display: flex;
  align-items: center;
  gap: 14px;
  padding-top: 10px;
  border-top: 1px dashed var(--ih-border);
}

.ih-submission__like,
.ih-submission__delete {
  border: none;
  background: none;
  cursor: pointer;
  font-size: 13px;
  padding: 4px 8px;
  border-radius: 999px;
  font-family: inherit;
}

.ih-submission__like {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--ih-text-secondary);
}

.ih-submission__like:hover:not(:disabled) {
  background: var(--ih-primary-light);
  color: var(--ih-primary-dark);
}

.ih-submission__like-icon {
  font-size: 14px;
}

.ih-submission__delete {
  margin-left: auto;
}

.ih-submission__delete:hover {
  color: #c45c5c;
}
</style>
