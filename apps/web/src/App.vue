<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router';
import { Plus } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import { useAuthStore } from './stores/auth';

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();

const navItems = [
  { to: '/', label: '我的菜谱' },
  { to: '/square', label: '菜谱广场' },
  { to: '/submissions', label: '交作业' },
];

/**
 * 自己算高亮而不是用 RouterLink 的 active-class：后者是前缀匹配，
 * 「/」会在每个页面都亮。菜谱详情（/recipes/:id）算在「我的菜谱」下。
 */
function isActive(to: string) {
  if (to === '/') return route.path === '/' || route.path.startsWith('/recipes');
  return route.path.startsWith(to);
}

function handleUserCommand(command: string) {
  if (command === 'profile') router.push('/profile');
  if (command === 'logout') logout();
}

async function logout() {
  await authStore.logout();
  ElMessage.success('已退出登录');
  router.push('/');
}
</script>

<template>
  <div class="ih-shell">
    <header class="ih-topbar">
      <div class="ih-topbar__inner">
        <RouterLink to="/" class="ih-brand">
          <span class="ih-brand__mark">🍲</span>
          <span class="ih-brand__name">iHelper</span>
          <span class="ih-brand__sub">菜谱</span>
        </RouterLink>

        <nav class="ih-nav">
          <RouterLink
            v-for="item in navItems"
            :key="item.to"
            :to="item.to"
            class="ih-nav__link"
            :class="{ 'ih-nav__link--active': isActive(item.to) }"
          >
            {{ item.label }}
          </RouterLink>
        </nav>

        <el-button type="primary" round :icon="Plus" @click="router.push('/recipes/new')">
          新建菜谱
        </el-button>

        <el-dropdown v-if="authStore.user" class="ih-user" trigger="click" @command="handleUserCommand">
          <span class="ih-user__trigger">
            <span class="ih-user__avatar">{{ authStore.user.displayName.slice(0, 1) }}</span>
            <span class="ih-user__name">{{ authStore.user.displayName }}</span>
          </span>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="profile">个人信息</el-dropdown-item>
              <el-dropdown-item command="logout" divided>退出登录</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
        <el-button v-else round class="ih-user" @click="router.push('/login')">登录</el-button>
      </div>
    </header>
    <main class="ih-main">
      <RouterView />
    </main>
  </div>
</template>

<style scoped>
.ih-shell {
  min-height: 100%;
  display: flex;
  flex-direction: column;
}

.ih-topbar {
  position: sticky;
  top: 0;
  z-index: 10;
  background: rgba(250, 246, 241, 0.9);
  backdrop-filter: blur(8px);
  border-bottom: 1px solid var(--ih-border);
}

.ih-topbar__inner {
  max-width: 1080px;
  margin: 0 auto;
  padding: 14px 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.ih-brand {
  display: inline-flex;
  align-items: baseline;
  gap: 8px;
  text-decoration: none;
  color: var(--ih-text);
}

.ih-brand__mark {
  font-size: 22px;
  line-height: 1;
}

.ih-brand__name {
  font-size: 20px;
  font-weight: 800;
  letter-spacing: 0.02em;
}

.ih-brand__sub {
  font-size: 14px;
  color: var(--ih-text-secondary);
  font-weight: 500;
}

.ih-nav {
  display: flex;
  gap: 4px;
  margin-left: 28px;
  margin-right: auto;
}

.ih-nav__link {
  padding: 7px 16px;
  border-radius: 999px;
  text-decoration: none;
  color: var(--ih-text-secondary);
  font-size: 15px;
  font-weight: 500;
  transition:
    background 0.2s ease,
    color 0.2s ease;
  white-space: nowrap;
}

.ih-nav__link:hover {
  color: var(--ih-primary-dark);
  background: rgba(226, 98, 44, 0.07);
}

.ih-nav__link--active {
  color: var(--ih-primary-dark);
  background: var(--ih-primary-light);
  font-weight: 600;
}

.ih-user {
  margin-left: 10px;
  flex-shrink: 0;
}

.ih-user__trigger {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 4px 10px 4px 4px;
  border-radius: 999px;
  transition: background 0.2s ease;
}

.ih-user__trigger:hover {
  background: rgba(226, 98, 44, 0.07);
}

.ih-user__avatar {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: var(--ih-primary-light);
  color: var(--ih-primary-dark);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 14px;
  flex-shrink: 0;
}

.ih-user__name {
  font-size: 14px;
  font-weight: 600;
  color: var(--ih-text);
  white-space: nowrap;
}

@media (max-width: 640px) {
  .ih-topbar__inner {
    flex-wrap: wrap;
    gap: 10px;
  }

  .ih-nav {
    order: 3;
    width: 100%;
    margin: 0;
    overflow-x: auto;
  }
}

.ih-main {
  flex: 1;
  max-width: 1080px;
  width: 100%;
  margin: 0 auto;
  padding: 28px 24px 64px;
}
</style>
