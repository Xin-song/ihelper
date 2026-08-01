<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Clock, Edit, Delete, Printer, Upload } from '@element-plus/icons-vue';
import type { RecipeDetailDto, RecipeVisibility, SubmissionDto } from '@ihelper/shared';
import { formatScaledQuantity, scaleQuantity } from '@ihelper/shared';
import { recipesApi } from '../api/recipes';
import { submissionsApi } from '../api/submissions';
import { useRecipesStore } from '../stores/recipes';
import SubmissionCard from '../components/SubmissionCard.vue';
import SubmissionForm from '../components/SubmissionForm.vue';

const route = useRoute();
const router = useRouter();
const store = useRecipesStore();

const recipe = ref<RecipeDetailDto | null>(null);
const loading = ref(true);
const targetServings = ref(1);

const submissions = ref<SubmissionDto[]>([]);
const showSubmissionForm = ref(false);

async function load() {
  loading.value = true;
  try {
    const id = route.params.id as string;
    recipe.value = await recipesApi.get(id);
    targetServings.value = recipe.value.servings;
    submissions.value = await submissionsApi.listByRecipe(id);
  } finally {
    loading.value = false;
  }
}

onMounted(load);

function onSubmissionCreated(created: SubmissionDto) {
  submissions.value = [created, ...submissions.value];
}

function onSubmissionRemoved(id: string) {
  submissions.value = submissions.value.filter((s) => s.id !== id);
}

/** 公开 / 收回都是一次 PATCH，改完顺手让列表缓存失效 */
async function setVisibility(visibility: RecipeVisibility) {
  if (!recipe.value) return;
  try {
    const updated = await recipesApi.update(recipe.value.id, { visibility });
    recipe.value.visibility = updated.visibility;
    store.invalidate();
    ElMessage.success(visibility === 'public' ? '已公开到菜谱广场' : '已收回，仅自己可见');
  } catch (error) {
    ElMessage.error((error as Error).message);
  }
}

const scaledIngredients = computed(() => {
  if (!recipe.value) return [];
  return recipe.value.recipeIngredients.map((ri) => {
    if (ri.amountType === 'vague' || ri.quantity === null) {
      return { ...ri, displayAmount: ri.vagueLabel ?? '适量' };
    }
    const scaled = scaleQuantity(ri.quantity, recipe.value!.servings, targetServings.value);
    return { ...ri, displayAmount: `${formatScaledQuantity(scaled)} ${ri.unit ?? ''}`.trim() };
  });
});

const totalMinutes = computed(() => {
  if (!recipe.value) return null;
  const total = (recipe.value.prepMinutes ?? 0) + (recipe.value.cookMinutes ?? 0);
  return total > 0 ? total : null;
});

async function handleDelete() {
  if (!recipe.value) return;
  await ElMessageBox.confirm(`确定删除「${recipe.value.title}」吗？可通过数据库恢复。`, '删除菜谱', {
    type: 'warning',
    confirmButtonText: '删除',
    cancelButtonText: '取消',
  });
  await recipesApi.remove(recipe.value.id);
  store.invalidate();
  ElMessage.success('已删除');
  router.push('/');
}
</script>

<template>
  <div v-if="loading" class="ih-detail-loading">
    <el-skeleton :rows="8" animated />
  </div>

  <div v-else-if="recipe" class="ih-detail">
    <div class="ih-detail__cover">
      <img v-if="recipe.coverImageUrl" :src="recipe.coverImageUrl" :alt="recipe.title" />
      <div v-else class="ih-detail__placeholder">🍽️</div>
    </div>

    <div class="ih-detail__header">
      <div>
        <h1 class="ih-heading ih-detail__title">{{ recipe.title }}</h1>
        <p v-if="recipe.description" class="ih-muted ih-detail__desc">{{ recipe.description }}</p>
        <div class="ih-detail__tags">
          <span v-for="tag in recipe.tags" :key="tag" class="ih-chip">{{ tag }}</span>
        </div>
      </div>
      <div class="ih-detail__actions">
        <el-button :icon="Upload" round type="primary" @click="showSubmissionForm = true">
          交作业
        </el-button>
        <el-button :icon="Printer" round @click="router.push(`/recipes/${recipe.id}/print`)">
          打印版
        </el-button>
        <el-button :icon="Edit" round @click="router.push(`/recipes/${recipe.id}/edit`)">
          编辑
        </el-button>
        <el-button :icon="Delete" round type="danger" plain @click="handleDelete">删除</el-button>
      </div>
    </div>

    <div class="ih-detail__meta">
      <span v-if="totalMinutes" class="ih-detail__meta-item ih-muted">
        <el-icon><Clock /></el-icon>
        {{ totalMinutes }} 分钟（备料 {{ recipe.prepMinutes ?? 0 }} + 烹饪
        {{ recipe.cookMinutes ?? 0 }}）
      </span>
      <el-rate
        v-if="recipe.difficulty"
        :model-value="recipe.difficulty"
        disabled
        :colors="['#e2622c', '#e2622c', '#e2622c']"
        void-color="#ece2d6"
      />
      <span v-if="recipe.source" class="ih-muted">来源：{{ recipe.source }}</span>

      <div class="ih-detail__visibility">
        <el-switch
          :model-value="recipe.visibility === 'public'"
          active-text="公开到广场"
          inactive-text="仅自己可见"
          inline-prompt
          @update:model-value="setVisibility($event ? 'public' : 'private')"
        />
      </div>
    </div>

    <div class="ih-detail__grid">
      <section class="ih-panel ih-card">
        <div class="ih-panel__header">
          <h2 class="ih-heading">配料</h2>
          <div class="ih-servings-scaler">
            <span class="ih-muted">份数</span>
            <el-input-number v-model="targetServings" :min="0.5" :step="0.5" size="small" />
          </div>
        </div>
        <ul class="ih-ingredient-list">
          <li v-for="ri in scaledIngredients" :key="ri.id" class="ih-ingredient-row">
            <span class="ih-ingredient-row__name">
              {{ ri.ingredient.name }}
              <em v-if="ri.isOptional" class="ih-muted">（可选）</em>
            </span>
            <span class="ih-ingredient-row__amount">{{ ri.displayAmount }}</span>
          </li>
          <li v-if="scaledIngredients.length === 0" class="ih-muted">还没有配料</li>
        </ul>
        <p class="ih-detail__hint ih-muted">缩放仅用于展示，不会修改原始配方</p>
      </section>

      <section class="ih-panel ih-card">
        <h2 class="ih-heading">步骤</h2>
        <ol class="ih-step-list">
          <li v-for="step in recipe.steps" :key="step.stepNumber" class="ih-step-row">
            <span class="ih-step-row__number">{{ step.stepNumber }}</span>
            <div class="ih-step-row__body">
              <p>{{ step.body }}</p>
              <span v-if="step.timerSeconds" class="ih-chip ih-chip--muted">
                <el-icon><Clock /></el-icon>
                {{ Math.round(step.timerSeconds / 60) }} 分钟
              </span>
            </div>
          </li>
          <li v-if="recipe.steps.length === 0" class="ih-muted">还没有步骤</li>
        </ol>
      </section>
    </div>

    <section class="ih-submissions">
      <div class="ih-submissions__header">
        <h2 class="ih-heading">用户作业（{{ submissions.length }}）</h2>
        <el-button :icon="Upload" round size="small" @click="showSubmissionForm = true">
          交作业
        </el-button>
      </div>

      <el-empty
        v-if="submissions.length === 0"
        description="还没有人交这道菜的作业，来当第一个"
        :image-size="90"
      />

      <div v-else class="ih-submissions__list">
        <SubmissionCard
          v-for="submission in submissions"
          :key="submission.id"
          :submission="submission"
          @removed="onSubmissionRemoved"
        />
      </div>
    </section>

    <SubmissionForm
      v-model="showSubmissionForm"
      :recipe-id="recipe.id"
      :recipe-title="recipe.title"
      @created="onSubmissionCreated"
    />
  </div>
</template>

<style scoped>
.ih-detail__cover {
  aspect-ratio: 21 / 9;
  border-radius: var(--ih-radius);
  overflow: hidden;
  background: linear-gradient(135deg, var(--ih-primary-light), #f3e6da);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 20px;
}

.ih-detail__cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.ih-detail__placeholder {
  font-size: 64px;
  opacity: 0.7;
}

.ih-detail__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 16px;
}

.ih-detail__title {
  font-size: 30px;
  margin: 0 0 8px;
}

.ih-detail__desc {
  margin: 0 0 10px;
  max-width: 560px;
}

.ih-detail__tags {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.ih-detail__actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

.ih-detail__meta {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 14px 0;
  margin-bottom: 24px;
  border-top: 1px solid var(--ih-border);
  border-bottom: 1px solid var(--ih-border);
  font-size: 14px;
}

.ih-detail__meta-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.ih-detail__grid {
  display: grid;
  grid-template-columns: 320px 1fr;
  gap: 20px;
  align-items: start;
}

@media (max-width: 760px) {
  .ih-detail__grid {
    grid-template-columns: 1fr;
  }
}

.ih-panel {
  padding: 20px 22px;
}

.ih-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.ih-panel h2 {
  margin: 0 0 12px;
  font-size: 18px;
}

.ih-panel__header h2 {
  margin: 0;
}

.ih-servings-scaler {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}

.ih-ingredient-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.ih-ingredient-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 10px;
  border-bottom: 1px dashed var(--ih-border);
  font-size: 14px;
}

.ih-ingredient-row:last-child {
  border-bottom: none;
}

.ih-ingredient-row__amount {
  font-weight: 600;
  color: var(--ih-primary-dark);
  white-space: nowrap;
}

.ih-detail__hint {
  font-size: 12px;
  margin-top: 14px;
}

.ih-step-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.ih-step-row {
  display: flex;
  gap: 14px;
}

.ih-step-row__number {
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--ih-primary);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 13px;
}

.ih-step-row__body p {
  margin: 0 0 6px;
  line-height: 1.7;
}

.ih-detail__visibility {
  margin-left: auto;
}

.ih-submissions {
  margin-top: 32px;
  padding-top: 24px;
  border-top: 1px solid var(--ih-border);
}

.ih-submissions__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 18px;
}

.ih-submissions__header h2 {
  margin: 0;
  font-size: 20px;
}

.ih-submissions__list {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 620px;
}

.ih-detail-loading {
  padding: 40px 0;
}
</style>
