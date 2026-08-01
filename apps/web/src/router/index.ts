import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '../stores/auth';

declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean;
  }
}

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
      meta: { requiresAuth: true },
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
      meta: { requiresAuth: true },
    },
    {
      path: '/recipes/:id/print',
      name: 'recipe-print',
      component: () => import('../views/RecipePrintView.vue'),
      props: true,
      meta: { requiresAuth: true },
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
    {
      path: '/login',
      name: 'login',
      component: () => import('../views/LoginView.vue'),
    },
    {
      path: '/register',
      name: 'register',
      component: () => import('../views/RegisterView.vue'),
    },
    {
      path: '/profile',
      name: 'profile',
      component: () => import('../views/ProfileView.vue'),
      meta: { requiresAuth: true },
    },
  ],
});

router.beforeEach((to) => {
  const authStore = useAuthStore();
  if (to.meta.requiresAuth && !authStore.isLoggedIn) {
    return { path: '/login', query: { redirect: to.fullPath } };
  }
});

export default router;
