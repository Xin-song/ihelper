<script setup lang="ts">
import { computed } from 'vue';
import type { RecipeListItemDto } from '@ihelper/shared';
import { Clock } from '@element-plus/icons-vue';

const props = defineProps<{ recipe: RecipeListItemDto }>();

const totalMinutes = computed(() => {
  const total = (props.recipe.prepMinutes ?? 0) + (props.recipe.cookMinutes ?? 0);
  return total > 0 ? total : null;
});
</script>

<template>
  <RouterLink :to="`/recipes/${recipe.id}`" class="ih-recipe-card ih-card ih-card--hoverable">
    <div class="ih-recipe-card__cover">
      <img v-if="recipe.coverImageUrl" :src="recipe.coverImageUrl" :alt="recipe.title" />
      <div v-else class="ih-recipe-card__placeholder">🍳</div>
      <span v-if="recipe.visibility === 'public'" class="ih-recipe-card__badge">公开</span>
      <span v-if="recipe.submissionCount" class="ih-recipe-card__badge ih-recipe-card__badge--left">
        {{ recipe.submissionCount }} 份作业
      </span>
    </div>
    <div class="ih-recipe-card__body">
      <h3 class="ih-recipe-card__title ih-heading">{{ recipe.title }}</h3>
      <p v-if="recipe.description" class="ih-recipe-card__desc ih-muted">
        {{ recipe.description }}
      </p>
      <div class="ih-recipe-card__tags">
        <span v-for="tag in recipe.tags.slice(0, 3)" :key="tag" class="ih-chip">{{ tag }}</span>
      </div>
      <div class="ih-recipe-card__meta ih-muted">
        <span v-if="totalMinutes" class="ih-recipe-card__meta-item">
          <el-icon><Clock /></el-icon>
          {{ totalMinutes }} 分钟
        </span>
        <el-rate
          v-if="recipe.difficulty"
          :model-value="recipe.difficulty"
          disabled
          size="small"
          :colors="['#e2622c', '#e2622c', '#e2622c']"
          void-color="#ece2d6"
        />
        <span>{{ recipe.servings }} 人份</span>
      </div>
    </div>
  </RouterLink>
</template>

<style scoped>
.ih-recipe-card {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  text-decoration: none;
  color: inherit;
  height: 100%;
}

.ih-recipe-card__cover {
  position: relative;
  aspect-ratio: 4 / 3;
  background: linear-gradient(135deg, var(--ih-primary-light), #f3e6da);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.ih-recipe-card__cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.ih-recipe-card__placeholder {
  font-size: 48px;
  opacity: 0.7;
}

.ih-recipe-card__badge {
  position: absolute;
  top: 10px;
  right: 10px;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  background: rgba(44, 35, 29, 0.6);
  color: #fff;
  backdrop-filter: blur(4px);
}

.ih-recipe-card__badge--left {
  right: auto;
  left: 10px;
  background: rgba(226, 98, 44, 0.9);
}

.ih-recipe-card__body {
  padding: 16px 18px 18px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1;
}

.ih-recipe-card__title {
  margin: 0;
  font-size: 17px;
}

.ih-recipe-card__desc {
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.ih-recipe-card__tags {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  min-height: 22px;
}

.ih-recipe-card__meta {
  margin-top: auto;
  display: flex;
  align-items: center;
  gap: 14px;
  font-size: 12px;
  padding-top: 8px;
  border-top: 1px dashed var(--ih-border);
}

.ih-recipe-card__meta-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
</style>
