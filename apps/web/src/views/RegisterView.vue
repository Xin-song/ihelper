<script setup lang="ts">
import { reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { useAuthStore } from '../stores/auth';

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();

const form = reactive({ username: '', password: '', confirmPassword: '' });
const submitting = ref(false);

async function submit() {
  if (!form.username.trim() || !form.password) {
    ElMessage.warning('用户名和密码都要填');
    return;
  }
  if (form.password !== form.confirmPassword) {
    ElMessage.warning('两次输入的密码不一致');
    return;
  }
  submitting.value = true;
  try {
    await authStore.register(form.username.trim(), form.password, form.confirmPassword);
    ElMessage.success('注册成功');
    const redirect = (route.query.redirect as string) || '/';
    router.replace(redirect);
  } catch (error) {
    ElMessage.error((error as Error).message);
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <div class="ih-login">
    <div class="ih-login__card ih-card">
      <h1 class="ih-heading ih-login__title">注册 iHelper</h1>
      <el-form label-position="top" @submit.prevent="submit">
        <el-form-item label="用户名">
          <el-input
            v-model="form.username"
            placeholder="字母、数字、下划线，3-32 位"
            @keyup.enter="submit"
          />
        </el-form-item>
        <el-form-item label="密码">
          <el-input
            v-model="form.password"
            type="password"
            show-password
            placeholder="至少 8 位"
            @keyup.enter="submit"
          />
        </el-form-item>
        <el-form-item label="确认密码">
          <el-input
            v-model="form.confirmPassword"
            type="password"
            show-password
            placeholder="再输入一遍，防止打错"
            @keyup.enter="submit"
          />
        </el-form-item>
        <el-button
          type="primary"
          round
          class="ih-login__submit"
          :loading="submitting"
          @click="submit"
        >
          注册
        </el-button>
      </el-form>
      <p class="ih-login__switch ih-muted">
        已有账号？
        <RouterLink :to="{ path: '/login', query: route.query }">去登录</RouterLink>
      </p>
    </div>
  </div>
</template>

<style scoped>
.ih-login {
  display: flex;
  justify-content: center;
  padding-top: 64px;
}

.ih-login__card {
  width: min(360px, 100%);
  padding: 32px 28px;
}

.ih-login__title {
  font-size: 22px;
  margin: 0 0 24px;
  text-align: center;
}

.ih-login__submit {
  width: 100%;
}

.ih-login__switch {
  margin: 16px 0 0;
  text-align: center;
  font-size: 13px;
}
</style>
