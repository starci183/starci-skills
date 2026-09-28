import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['apps/web/src/**/*.spec.{ts,tsx}', 'apps/web/test/**/*.spec.{ts,tsx}'],
    setupFiles: ['./apps/web/vitest.setup.ts'],
    globals: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'json-summary'],
      reportsDirectory: 'coverage',
      include: ['apps/web/src/**/*.{ts,tsx}'],
      exclude: ['**/*.spec.{ts,tsx}', '**/*.test.{ts,tsx}', '**/*.d.ts'],
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./apps/web/src', import.meta.url)),
      '@test': fileURLToPath(new URL('./apps/web/test', import.meta.url)),
      '@fe-kit': fileURLToPath(new URL('../../packages/fe-kit/src', import.meta.url)),
    },
  },
  esbuild: { jsx: 'automatic' },
});
