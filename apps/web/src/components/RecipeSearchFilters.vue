<script setup lang="ts">
import { ref } from 'vue';
import { ElMessage } from 'element-plus';
import { Search } from '@element-plus/icons-vue';
import type { IngredientDto, RecipeListQuery } from '@ihelper/shared';
import { RECIPE_SORT_OPTIONS, RECIPE_SORT_OPTION_LABELS } from '@ihelper/shared';
import { ingredientsApi } from '../api/ingredients';

const props = defineProps<{
  query: RecipeListQuery;
  categoryOptions: string[];
  tagOptions: string[];
  hasActiveFilters: boolean;
}>();
const emit = defineEmits<{ reset: [] }>();

const DIFFICULTIES = [1, 2, 3, 4, 5];

/* ---------- 食材反查：远程搜索食材主数据，多选 ---------- */
const ingredientOptions = ref<IngredientDto[]>([]);
const ingredientsLoading = ref(false);
async function searchIngredients(keyword: string) {
  ingredientsLoading.value = true;
  try {
    ingredientOptions.value = await ingredientsApi.list(keyword || undefined);
  } catch (error) {
    ElMessage.error((error as Error).message);
  } finally {
    ingredientsLoading.value = false;
  }
}
searchIngredients('');
</script>

<template>
  <div class="ih-recipe-filters">
    <el-input
      v-model="props.query.keyword"
      placeholder="搜标题、简介、步骤"
      :prefix-icon="Search"
      clearable
      class="ih-recipe-filters__keyword"
    />
    <el-select v-model="props.query.category" placeholder="分类" clearable class="ih-recipe-filters__field">
      <el-option v-for="c in categoryOptions" :key="c" :value="c" :label="c" />
    </el-select>
    <el-select
      v-model="props.query.tags"
      placeholder="标签"
      multiple
      collapse-tags
      collapse-tags-tooltip
      clearable
      class="ih-recipe-filters__field ih-recipe-filters__field--wide"
    >
      <el-option v-for="t in tagOptions" :key="t" :value="t" :label="t" />
    </el-select>
    <el-select v-model="props.query.difficulty" placeholder="难度" clearable class="ih-recipe-filters__field">
      <el-option v-for="d in DIFFICULTIES" :key="d" :value="d" :label="`${d} 星`" />
    </el-select>
    <el-input-number
      v-model="props.query.maxTotalMinutes"
      :min="1"
      :controls="false"
      clearable
      placeholder="总耗时 ≤ 分钟"
      class="ih-recipe-filters__field"
    />
    <el-select
      v-model="props.query.ingredientIds"
      placeholder="有这些食材，能做什么"
      multiple
      filterable
      remote
      collapse-tags
      collapse-tags-tooltip
      reserve-keyword
      :remote-method="searchIngredients"
      :loading="ingredientsLoading"
      class="ih-recipe-filters__field ih-recipe-filters__field--wide"
    >
      <el-option v-for="opt in ingredientOptions" :key="opt.id" :value="opt.id" :label="opt.name" />
    </el-select>
    <el-select v-model="props.query.sortBy" placeholder="排序" clearable class="ih-recipe-filters__field">
      <el-option v-for="s in RECIPE_SORT_OPTIONS" :key="s" :value="s" :label="RECIPE_SORT_OPTION_LABELS[s]" />
    </el-select>
    <el-button v-if="hasActiveFilters" text @click="emit('reset')">清空筛选</el-button>
  </div>
</template>

<style scoped>
.ih-recipe-filters {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-bottom: 18px;
}

.ih-recipe-filters__keyword {
  width: 220px;
}

.ih-recipe-filters__field {
  width: 130px;
}

.ih-recipe-filters__field--wide {
  width: 220px;
}
</style>
