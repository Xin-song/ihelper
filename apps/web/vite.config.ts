import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      // 上传的图片由后端静态目录提供。走代理而不是直连 :3000，
      // 是为了让图片和页面同源 —— 否则 canvas 画上去会被污染，导不出 PNG。
      '/uploads': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
