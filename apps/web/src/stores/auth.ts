import { defineStore } from 'pinia';
import type { UserDto } from '@ihelper/shared';
import { authApi } from '../api/auth';

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null as UserDto | null,
    /** 是否已经问过一次 /auth/me —— 用来区分「还不知道」和「确实没登录」 */
    ready: false,
  }),
  getters: {
    isLoggedIn: (state) => state.user !== null,
  },
  actions: {
    /** App 启动时调用一次，靠 httpOnly cookie 恢复登录态 */
    async fetchMe() {
      try {
        this.user = await authApi.me();
      } catch {
        this.user = null;
      } finally {
        this.ready = true;
      }
    },
    async login(username: string, password: string) {
      this.user = await authApi.login({ username, password });
    },
    async register(username: string, password: string, confirmPassword: string) {
      this.user = await authApi.register({ username, password, confirmPassword });
    },
    async logout() {
      await authApi.logout();
      this.user = null;
    },
    setUser(user: UserDto) {
      this.user = user;
    },
  },
});
