import { computed, reactive, ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import type { RecipeListItemDto, RecipeListQuery } from '@ihelper/shared';

/**
 * 菜谱搜索/筛选：查询条件变化后防抖发一次请求。「我的菜谱」「菜谱广场」共用，
 * 传入各自的 fetcher（recipesApi.list / recipesApi.square）。
 * 没有任何筛选条件时不发请求，交给调用方回退到已经缓存好的未筛选列表。
 */
export function useRecipeSearch(fetcher: (query: RecipeListQuery) => Promise<RecipeListItemDto[]>) {
  const query = reactive<RecipeListQuery>({});
  const results = ref<RecipeListItemDto[]>([]);
  const loading = ref(false);

  const hasActiveFilters = computed(() =>
    Object.values(query).some((v) => (Array.isArray(v) ? v.length > 0 : !!v)),
  );

  async function run() {
    if (!hasActiveFilters.value) {
      results.value = [];
      return;
    }
    loading.value = true;
    try {
      results.value = await fetcher({ ...query });
    } catch (error) {
      ElMessage.error((error as Error).message);
    } finally {
      loading.value = false;
    }
  }

  let timer: ReturnType<typeof setTimeout> | null = null;
  watch(
    query,
    () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(run, 300);
    },
    { deep: true },
  );

  function reset() {
    (Object.keys(query) as (keyof RecipeListQuery)[]).forEach((key) => {
      delete query[key];
    });
  }

  return { query, results, loading, hasActiveFilters, reset };
}
