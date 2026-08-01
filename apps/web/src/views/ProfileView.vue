<script setup lang="ts">
import { reactive, ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { authApi } from '../api/auth';
import { useAuthStore } from '../stores/auth';

const authStore = useAuthStore();

const profileForm = reactive({ displayName: '' });
const savingProfile = ref(false);

watch(
  () => authStore.user,
  (user) => {
    profileForm.displayName = user?.displayName ?? '';
  },
  { immediate: true },
);

async function saveProfile() {
  if (!profileForm.displayName.trim()) {
    ElMessage.warning('昵称不能为空');
    return;
  }
  savingProfile.value = true;
  try {
    const updated = await authApi.updateProfile({ displayName: profileForm.displayName.trim() });
    authStore.setUser(updated);
    ElMessage.success('已保存');
  } catch (error) {
    ElMessage.error((error as Error).message);
  } finally {
    savingProfile.value = false;
  }
}

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
</script>

<template>
  <div class="ih-profile">
    <h1 class="ih-heading ih-page-title">个人信息</h1>

    <section v-if="authStore.user" class="ih-panel ih-card">
      <h2 class="ih-heading">基本信息</h2>
      <dl class="ih-profile__facts">
        <dt class="ih-muted">用户名</dt>
        <dd>{{ authStore.user.username }}</dd>
        <dt class="ih-muted">注册时间</dt>
        <dd>{{ new Date(authStore.user.createdAt).toLocaleDateString('zh-CN') }}</dd>
      </dl>

      <el-form label-position="top" class="ih-profile__form">
        <el-form-item label="昵称">
          <el-input v-model="profileForm.displayName" maxlength="40" show-word-limit />
        </el-form-item>
        <el-button type="primary" round :loading="savingProfile" @click="saveProfile">
          保存昵称
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
  </div>
</template>

<style scoped>
.ih-profile {
  max-width: 480px;
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

.ih-profile__facts {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 6px 16px;
  margin: 0 0 18px;
  font-size: 14px;
}

.ih-profile__facts dd {
  margin: 0;
}

.ih-profile__form {
  max-width: 320px;
}
</style>
