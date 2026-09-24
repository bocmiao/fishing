import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  // 相对路径，方便以后用 Electron 从本地文件加载
  base: './',
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
  preview: { host: '127.0.0.1', port: 4173, strictPort: true },
  // 桌面游戏从本地加载，单个文件大一些没关系
  build: { chunkSizeWarningLimit: 4000 },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
