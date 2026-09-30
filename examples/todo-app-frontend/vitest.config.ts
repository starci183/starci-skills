import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['apps/web/src/**/*.spec.{ts,tsx}'],
    setupFiles: ['./vitest.setup.ts'],
    globals: false,
    env: { NEXT_PUBLIC_API_GRAPHQL_URL: 'http://localhost:3001/graphql' },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./apps/web/src', import.meta.url)),
      '@fe-kit': fileURLToPath(new URL('../../packages/fe-kit/src', import.meta.url)),
    },
  },
  esbuild: { jsx: 'automatic' },
});
