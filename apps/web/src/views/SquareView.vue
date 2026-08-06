<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import type { RecipeListItemDto } from '@ihelper/shared';
import { recipesApi } from '../api/recipes';
import { useRecipeSearch } from '../composables/useRecipeSearch';
import RecipeCard from '../components/RecipeCard.vue';
import RecipeSearchFilters from '../components/RecipeSearchFilters.vue';

/** 未筛选时的基线数据：默认展示 + 筛选下拉的可选项来源 */
const baseline = ref<RecipeListItemDto[]>([]);
const baselineLoading = ref(true);

onMounted(async () => {
  try {
    baseline.value = await recipesApi.square();
  } catch (error) {
    ElMessage.error((error as Error).message);
  } finally {
    baselineLoading.value = false;
  }
});

const { query, results, loading: searchLoading, hasActiveFilters, reset } = useRecipeSearch((q) =>
  recipesApi.square(q),
);

const categoryOptions = computed(() =>
  [...new Set(baseline.value.map((r) => r.category).filter((c): c is string => !!c))].sort(),
);
const tagOptions = computed(() => [...new Set(baseline.value.flatMap((r) => r.tags))].sort());

const displayedItems = computed(() => (hasActiveFilters.value ? results.value : baseline.value));
const listLoading = computed(() => (hasActiveFilters.value ? searchLoading.value : baselineLoading.value));
</script>

<template>
  <div>
    <div class="ih-page-header">
      <h1 class="ih-heading ih-page-title">菜谱广场</h1>
      <p class="ih-muted">大家公开出来的菜谱，看看今天做点什么</p>
    </div>

    <RecipeSearchFilters
      :query="query"
      :category-options="categoryOptions"
      :tag-options="tagOptions"
      :has-active-filters="hasActiveFilters"
      @reset="reset"
    />

    <div v-if="listLoading" class="ih-grid">
      <div v-for="i in 6" :key="i" class="ih-skeleton ih-card"></div>
    </div>

    <el-empty v-else-if="displayedItems.length === 0 && !hasActiveFilters" class="ih-empty">
      <template #description>
        <p>广场上还没有公开的菜谱</p>
        <p class="ih-muted ih-empty__hint">
          在菜谱详情页把可见性改成「公开到广场」，它就会出现在这里
        </p>
      </template>
      <el-button type="primary" round @click="$router.push('/')">去我的菜谱</el-button>
    </el-empty>

    <el-empty
      v-else-if="displayedItems.length === 0"
      description="没有符合条件的菜谱，换个筛选条件试试"
      class="ih-empty"
    />

    <div v-else class="ih-grid">
      <RecipeCard v-for="recipe in displayedItems" :key="recipe.id" :recipe="recipe" />
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

.ih-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 20px;
}

.ih-skeleton {
  aspect-ratio: 4 / 5;
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

.ih-empty {
  padding: 80px 0;
}

.ih-empty__hint {
  font-size: 13px;
  margin: 6px 0 0;
}
</style>
