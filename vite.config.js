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
  },
})
