import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

const emptyCss = fileURLToPath(new URL('./src/web/empty.css', import.meta.url));

/**
 * 网页版（mode = artifact）：发布成可以直接在浏览器里玩的页面。
 * 桌面版会把字体打包进来（离线可用）；网页版字体文件太多，改从 Google Fonts 加载同一款思源宋体。
 */
function webFonts(): Plugin {
  return {
    name: 'web-fonts',
    transformIndexHtml(html) {
      const link =
        '<link rel="preconnect" href="https://fonts.googleapis.com" />\n' +
        '    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />\n' +
        '    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;600&display=swap" />';
      return html.replace('</title>', `</title>\n    ${link}`);
    },
  };
}

export default defineConfig(({ mode }) => {
  const web = mode === 'artifact';
  return {
    plugins: [react(), ...(web ? [webFonts()] : [])],
    // 相对路径，方便以后用 Electron 从本地文件加载
    base: './',
    resolve: {
      alias: web ? [{ find: /^@fontsource\/noto-serif-sc\/\d+\.css$/, replacement: emptyCss }] : [],
    },
    server: { host: '127.0.0.1', port: 5173, strictPort: true },
    preview: { host: '127.0.0.1', port: 4173, strictPort: true },
    // 桌面游戏从本地加载，单个文件大一些没关系
    build: { chunkSizeWarningLimit: 4000, outDir: web ? 'dist-web' : 'dist' },
    test: {
      include: ['tests/**/*.test.ts'],
      environment: 'node',
    },
  };
});
