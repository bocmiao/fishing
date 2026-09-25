import { defineConfig } from 'vitest/config';

// 数值报告单独跑：npm run balance
export default defineConfig({
  test: { include: ['tools/balance/**/*.test.ts'], environment: 'node' },
});
