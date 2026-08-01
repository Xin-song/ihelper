<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import type { RecipeListItemDto } from '@ihelper/shared';
import { recipesApi } from '../api/recipes';
import RecipeCard from '../components/RecipeCard.vue';

const recipes = ref<RecipeListItemDto[]>([]);
const loading = ref(true);

onMounted(async () => {
  try {
    recipes.value = await recipesApi.square();
  } catch (error) {
    ElMessage.error((error as Error).message);
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <div>
    <div class="ih-page-header">
      <h1 class="ih-heading ih-page-title">菜谱广场</h1>
      <p class="ih-muted">大家公开出来的菜谱，看看今天做点什么</p>
    </div>

    <div v-if="loading" class="ih-grid">
      <div v-for="i in 6" :key="i" class="ih-skeleton ih-card"></div>
    </div>

    <el-empty v-else-if="recipes.length === 0" class="ih-empty">
      <template #description>
        <p>广场上还没有公开的菜谱</p>
        <p class="ih-muted ih-empty__hint">
          在菜谱详情页把可见性改成「公开到广场」，它就会出现在这里
        </p>
      </template>
      <el-button type="primary" round @click="$router.push('/')">去我的菜谱</el-button>
    </el-empty>

    <div v-else class="ih-grid">
      <RecipeCard v-for="recipe in recipes" :key="recipe.id" :recipe="recipe" />
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
