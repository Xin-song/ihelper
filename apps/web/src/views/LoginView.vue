<script setup lang="ts">
import { reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { useAuthStore } from '../stores/auth';

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();

const form = reactive({ username: '', password: '' });
const submitting = ref(false);

async function submit() {
  if (!form.username.trim() || !form.password) {
    ElMessage.warning('用户名和密码都要填');
    return;
  }
  submitting.value = true;
  try {
    await authStore.login(form.username.trim(), form.password);
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
      <h1 class="ih-heading ih-login__title">登录 iHelper</h1>
      <el-form label-position="top" @submit.prevent="submit">
        <el-form-item label="用户名">
          <el-input v-model="form.username" placeholder="用户名" @keyup.enter="submit" />
        </el-form-item>
        <el-form-item label="密码">
          <el-input
            v-model="form.password"
            type="password"
            show-password
            placeholder="密码"
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
          登录
        </el-button>
      </el-form>
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
</style>
