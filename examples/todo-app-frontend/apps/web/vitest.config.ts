import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@fe-kit': fileURLToPath(new URL('../../../../packages/fe-kit/src', import.meta.url)),
    },
  },
  esbuild: { jsx: 'automatic' },
  test: {
    name: 'todo-web',
    root: import.meta.dirname,
    environment: 'jsdom',
    include: ['src/**/*.spec.{ts,tsx}'],
    setupFiles: ['../../vitest.setup.ts'],
    globals: false,
    env: { NEXT_PUBLIC_API_GRAPHQL_URL: 'http://localhost:3001/graphql' },
  },
});
