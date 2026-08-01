<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import type { SubmissionDto } from '@ihelper/shared';
import { submissionsApi } from '../api/submissions';
import SubmissionCard from '../components/SubmissionCard.vue';

const submissions = ref<SubmissionDto[]>([]);
const loading = ref(true);

async function load() {
  loading.value = true;
  try {
    submissions.value = await submissionsApi.feed();
  } catch (error) {
    ElMessage.error((error as Error).message);
  } finally {
    loading.value = false;
  }
}

onMounted(load);

function onRemoved(id: string) {
  submissions.value = submissions.value.filter((s) => s.id !== id);
}
</script>

<template>
  <div>
    <div class="ih-page-header">
      <h1 class="ih-heading ih-page-title">交作业</h1>
      <p class="ih-muted">大家跟着菜谱做出来的成品和经验</p>
    </div>

    <div v-if="loading" class="ih-feed">
      <el-skeleton v-for="i in 3" :key="i" :rows="4" animated class="ih-card ih-feed__skeleton" />
    </div>

    <el-empty v-else-if="submissions.length === 0" class="ih-empty">
      <template #description>
        <p>还没有人交作业</p>
        <p class="ih-muted ih-empty__hint">
          打开任意一个菜谱，点「交作业」上传你的成品图和心得
        </p>
      </template>
      <el-button type="primary" round @click="$router.push('/')">去找道菜做</el-button>
    </el-empty>

    <div v-else class="ih-feed">
      <SubmissionCard
        v-for="submission in submissions"
        :key="submission.id"
        :submission="submission"
        show-recipe
        @removed="onRemoved"
      />
    </div>
  </div>
</template>

<style scoped>
.ih-page-header {
  margin-bottom: 24px;
}

.ih-page-title {
  font-size: 28px;
  margin: 0 0 4px;
}

.ih-feed {
  display: flex;
  flex-direction: column;
  gap: 18px;
  max-width: 620px;
}

.ih-feed__skeleton {
  padding: 20px;
}

.ih-empty {
  padding: 80px 0;
}

.ih-empty__hint {
  font-size: 13px;
  margin: 6px 0 0;
}
</style>
