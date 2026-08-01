import { createApp } from 'vue';
import { createPinia } from 'pinia';
import ElementPlus from 'element-plus';
import 'element-plus/dist/index.css';
import './styles/main.css';
import App from './App.vue';
import router from './router';
import { useAuthStore } from './stores/auth';

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.use(ElementPlus);

// 路由守卫要看登录态，挂载前先靠 httpOnly cookie 问一次「我是谁」
useAuthStore()
  .fetchMe()
  .finally(() => app.mount('#app'));
