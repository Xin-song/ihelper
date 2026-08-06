<script setup lang="ts">
import { onMounted, reactive, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import type { ProfileStatsDto } from '@ihelper/shared';
import { authApi } from '../api/auth';
import { useAuthStore } from '../stores/auth';
import ImageUploader from '../components/ImageUploader.vue';

const authStore = useAuthStore();
const router = useRouter();

/* ---------- 数据总览 ---------- */
const stats = ref<ProfileStatsDto | null>(null);
const statsLoading = ref(true);
async function loadStats() {
  statsLoading.value = true;
  try {
    stats.value = await authApi.stats();
  } catch (error) {
    ElMessage.error((error as Error).message);
  } finally {
    statsLoading.value = false;
  }
}
onMounted(loadStats);

/* ---------- 基本信息（昵称/邮箱/简介/头像一起保存） ---------- */
const profileForm = reactive({ displayName: '', email: '', bio: '', avatarUrl: '' });
const savingProfile = ref(false);

watch(
  () => authStore.user,
  (user) => {
    profileForm.displayName = user?.displayName ?? '';
    profileForm.email = user?.email ?? '';
    profileForm.bio = user?.bio ?? '';
    profileForm.avatarUrl = user?.avatarUrl ?? '';
  },
  { immediate: true },
);

function handleAvatarChange(urls: string[]) {
  profileForm.avatarUrl = urls[0] ?? '';
}

async function saveProfile() {
  if (!profileForm.displayName.trim()) {
    ElMessage.warning('昵称不能为空');
    return;
  }
  savingProfile.value = true;
  try {
    const updated = await authApi.updateProfile({
      displayName: profileForm.displayName.trim(),
      email: profileForm.email.trim() || null,
      bio: profileForm.bio.trim() || null,
      avatarUrl: profileForm.avatarUrl || null,
    });
    authStore.setUser(updated);
    ElMessage.success('已保存');
  } catch (error) {
    ElMessage.error((error as Error).message);
  } finally {
    savingProfile.value = false;
  }
}

/* ---------- 修改密码 ---------- */
const passwordForm = reactive({ currentPassword: '', newPassword: '', confirmPassword: '' });
const savingPassword = ref(false);

async function savePassword() {
  if (passwordForm.newPassword.length < 8) {
    ElMessage.warning('新密码至少 8 位');
    return;
  }
  if (passwordForm.newPassword !== passwordForm.confirmPassword) {
    ElMessage.warning('两次输入的新密码不一致');
    return;
  }
  savingPassword.value = true;
  try {
    await authApi.changePassword({
      currentPassword: passwordForm.currentPassword,
      newPassword: passwordForm.newPassword,
    });
    passwordForm.currentPassword = '';
    passwordForm.newPassword = '';
    passwordForm.confirmPassword = '';
    ElMessage.success('密码已修改');
  } catch (error) {
    ElMessage.error((error as Error).message);
  } finally {
    savingPassword.value = false;
  }
}

/* ---------- 数据导出 ---------- */
const exporting = ref(false);
async function exportData() {
  exporting.value = true;
  try {
    const data = await authApi.exportData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const a = document.createElement('a');
    a.href = url;
    a.download = `ihelper-导出-${dateStr}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    ElMessage.success('已开始下载');
  } catch (error) {
    ElMessage.error((error as Error).message);
  } finally {
    exporting.value = false;
  }
}

/* ---------- 危险操作：注销账号 ---------- */
const deleteDialogVisible = ref(false);
const deletePassword = ref('');
const deleting = ref(false);

async function confirmDeleteAccount() {
  if (!deletePassword.value) {
    ElMessage.warning('请输入密码');
    return;
  }
  deleting.value = true;
  try {
    await authApi.deleteAccount({ password: deletePassword.value });
    deleteDialogVisible.value = false;
    authStore.user = null;
    ElMessage.success('账号已注销');
    router.push('/');
  } catch (error) {
    ElMessage.error((error as Error).message);
  } finally {
    deleting.value = false;
    deletePassword.value = '';
  }
}
</script>

<template>
  <div class="ih-profile">
    <h1 class="ih-heading ih-page-title">个人信息</h1>

    <section v-if="authStore.user" class="ih-panel ih-card">
      <div class="ih-profile__header">
        <ImageUploader
          class="ih-avatar-uploader"
          :model-value="profileForm.avatarUrl ? [profileForm.avatarUrl] : []"
          :max="1"
          :size="88"
          @update:model-value="handleAvatarChange"
        />
        <dl class="ih-profile__facts">
          <dt class="ih-muted">用户名</dt>
          <dd>{{ authStore.user.username }}</dd>
          <dt class="ih-muted">注册时间</dt>
          <dd>
            {{ new Date(authStore.user.createdAt).toLocaleDateString('zh-CN') }}
            <span v-if="stats" class="ih-muted">（加入 {{ stats.daysSinceJoined }} 天）</span>
          </dd>
        </dl>
      </div>
    </section>

    <section class="ih-panel ih-card">
      <h2 class="ih-heading">数据总览</h2>
      <div v-if="statsLoading" class="ih-stats-grid">
        <div v-for="i in 4" :key="i" class="ih-skeleton"></div>
      </div>
      <div v-else-if="stats" class="ih-stats-grid">
        <div class="ih-stat-tile">
          <span class="ih-stat-tile__value">{{ stats.recipeCount }}</span>
          <span class="ih-muted ih-stat-tile__label">创建的菜谱</span>
        </div>
        <div class="ih-stat-tile">
          <span class="ih-stat-tile__value">{{ stats.submissionCount }}</span>
          <span class="ih-muted ih-stat-tile__label">交的作业</span>
        </div>
        <div class="ih-stat-tile">
          <span class="ih-stat-tile__value">{{ stats.taskDoneCount }} / {{ stats.taskTotalCount }}</span>
          <span class="ih-muted ih-stat-tile__label">待办完成</span>
        </div>
        <div class="ih-stat-tile">
          <span class="ih-stat-tile__value">{{ stats.stockItemCount }}</span>
          <span class="ih-muted ih-stat-tile__label">库存物品</span>
        </div>
      </div>
    </section>

    <section v-if="authStore.user" class="ih-panel ih-card">
      <h2 class="ih-heading">基本信息</h2>
      <el-form label-position="top" class="ih-profile__form">
        <el-form-item label="昵称">
          <el-input v-model="profileForm.displayName" maxlength="40" show-word-limit />
        </el-form-item>
        <el-form-item label="邮箱">
          <el-input v-model="profileForm.email" placeholder="不填表示不绑定邮箱" />
        </el-form-item>
        <el-form-item label="个性签名">
          <el-input
            v-model="profileForm.bio"
            type="textarea"
            :rows="2"
            maxlength="300"
            show-word-limit
            placeholder="一句话介绍自己"
          />
        </el-form-item>
        <el-button type="primary" round :loading="savingProfile" @click="saveProfile">
          保存基本信息
        </el-button>
      </el-form>
    </section>

    <section class="ih-panel ih-card">
      <h2 class="ih-heading">修改密码</h2>
      <el-form label-position="top" class="ih-profile__form">
        <el-form-item label="当前密码">
          <el-input v-model="passwordForm.currentPassword" type="password" show-password />
        </el-form-item>
        <el-form-item label="新密码">
          <el-input v-model="passwordForm.newPassword" type="password" show-password />
        </el-form-item>
        <el-form-item label="确认新密码">
          <el-input v-model="passwordForm.confirmPassword" type="password" show-password />
        </el-form-item>
        <el-button type="primary" round :loading="savingPassword" @click="savePassword">
          修改密码
        </el-button>
      </el-form>
    </section>

    <section class="ih-panel ih-card">
      <h2 class="ih-heading">数据导出</h2>
      <p class="ih-muted ih-export-hint">
        导出你名下的菜谱、作业、待办、日程为一份 JSON 文件，随时可以备份或迁移。
      </p>
      <el-button round :loading="exporting" @click="exportData">导出我的数据</el-button>
    </section>

    <section class="ih-panel ih-card ih-danger-zone">
      <h2 class="ih-heading ih-danger-zone__title">危险操作</h2>
      <p class="ih-muted">
        注销账号会让你的账号立即无法登录，已创建的内容不会自动删除。此操作无法撤销。
      </p>
      <el-button type="danger" plain round @click="deleteDialogVisible = true">注销账号</el-button>
    </section>

    <el-dialog v-model="deleteDialogVisible" title="注销账号" width="min(420px, 92vw)">
      <p class="ih-muted">请输入密码确认注销，此操作无法撤销。</p>
      <el-form label-position="top">
        <el-form-item label="密码">
          <el-input
            v-model="deletePassword"
            type="password"
            show-password
            @keyup.enter="confirmDeleteAccount"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button round @click="deleteDialogVisible = false">取消</el-button>
        <el-button type="danger" round :loading="deleting" @click="confirmDeleteAccount">
          确认注销
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.ih-profile {
  max-width: 560px;
}

.ih-page-title {
  font-size: 28px;
  margin: 0 0 24px;
}

.ih-panel {
  padding: 20px 22px;
  margin-bottom: 20px;
}

.ih-panel h2 {
  margin: 0 0 14px;
  font-size: 17px;
}

.ih-profile__header {
  display: flex;
  align-items: center;
  gap: 20px;
}

.ih-avatar-uploader :deep(.ih-uploader__item),
.ih-avatar-uploader :deep(.ih-uploader__add) {
  border-radius: 50%;
}

.ih-profile__facts {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 6px 16px;
  margin: 0;
  font-size: 14px;
}

.ih-profile__facts dd {
  margin: 0;
}

.ih-profile__form {
  max-width: 360px;
}

.ih-stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
  gap: 12px;
}

.ih-stat-tile {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 14px 16px;
  background: #faf8f5;
  border: 1px solid var(--ih-border);
  border-radius: var(--ih-radius-sm);
}

.ih-stat-tile__value {
  font-size: 24px;
  font-weight: 700;
  color: var(--ih-primary-dark);
}

.ih-stat-tile__label {
  font-size: 12px;
}

.ih-skeleton {
  height: 76px;
  border-radius: var(--ih-radius-sm);
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

.ih-export-hint {
  margin: 0 0 14px;
  font-size: 13px;
}

.ih-danger-zone {
  border-color: #e3a5a5;
}

.ih-danger-zone__title {
  color: #c45c5c;
}

.ih-danger-zone p {
  margin: 0 0 14px;
  font-size: 13px;
}
</style>
