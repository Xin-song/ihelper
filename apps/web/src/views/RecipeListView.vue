<script setup lang="ts">
import { onMounted } from 'vue';
import { useRecipesStore } from '../stores/recipes';
import RecipeCard from '../components/RecipeCard.vue';

const store = useRecipesStore();
onMounted(() => store.fetchAll());
</script>

<template>
  <div>
    <div class="ih-page-header">
      <div>
        <h1 class="ih-heading ih-page-title">我的菜谱</h1>
        <p class="ih-muted">{{ store.items.length }} 道菜，记录每一次好好吃饭</p>
      </div>
    </div>

    <div v-if="store.loading" class="ih-grid">
      <div v-for="i in 6" :key="i" class="ih-skeleton ih-card"></div>
    </div>

    <el-empty
      v-else-if="store.items.length === 0"
      description="还没有菜谱，先记录第一道吧"
      class="ih-empty"
    >
      <el-button type="primary" round @click="$router.push('/recipes/new')">新建菜谱</el-button>
    </el-empty>

    <div v-else class="ih-grid">
      <RecipeCard v-for="recipe in store.items" :key="recipe.id" :recipe="recipe" />
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
</style>
