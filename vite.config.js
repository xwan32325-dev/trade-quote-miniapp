import { defineConfig } from 'vite'
import uni from '@dcloudio/vite-plugin-uni'
// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    uni(),
  ],
  server: {
    host: '0.0.0.0',
    port: 5174, // H5 调试端口（5173 已被其它项目占用）
    strictPort: true,
    // H5 端接口走同源，开发时把 /api 代理到本机后端（生产环境由部署服务器反代）
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
      },
    },
  },
})
