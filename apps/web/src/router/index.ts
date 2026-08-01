import { createRouter, createWebHistory } from 'vue-router';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'recipe-list',
      component: () => import('../views/RecipeListView.vue'),
    },
    {
      path: '/recipes/new',
      name: 'recipe-new',
      component: () => import('../views/RecipeFormView.vue'),
    },
    {
      path: '/recipes/:id',
      name: 'recipe-detail',
      component: () => import('../views/RecipeDetailView.vue'),
      props: true,
    },
    {
      path: '/recipes/:id/edit',
      name: 'recipe-edit',
      component: () => import('../views/RecipeFormView.vue'),
      props: true,
    },
    {
      path: '/recipes/:id/print',
      name: 'recipe-print',
      component: () => import('../views/RecipePrintView.vue'),
      props: true,
    },
    {
      path: '/square',
      name: 'square',
      component: () => import('../views/SquareView.vue'),
    },
    {
      path: '/submissions',
      name: 'submissions',
      component: () => import('../views/SubmissionFeedView.vue'),
    },
  ],
});

export default router;
