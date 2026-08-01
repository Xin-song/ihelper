import { defineStore } from 'pinia';
import type { RecipeListItemDto } from '@ihelper/shared';
import { recipesApi } from '../api/recipes';

export const useRecipesStore = defineStore('recipes', {
  state: () => ({
    items: [] as RecipeListItemDto[],
    loaded: false,
    loading: false,
  }),
  actions: {
    async fetchAll(force = false) {
      if (this.loaded && !force) return;
      this.loading = true;
      try {
        this.items = await recipesApi.list();
        this.loaded = true;
      } finally {
        this.loading = false;
      }
    },
    invalidate() {
      this.loaded = false;
    },
  },
});
