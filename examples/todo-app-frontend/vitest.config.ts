import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['apps/web/src/**/*.spec.{ts,tsx}'],
    setupFiles: ['./vitest.setup.ts'],
    globals: false,
    env: { NEXT_PUBLIC_API_GRAPHQL_URL: 'http://localhost:3001/graphql' },
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
      '@fe-kit': fileURLToPath(new URL('../../packages/fe-kit/src', import.meta.url)),
    },
  },
  esbuild: { jsx: 'automatic' },
});
