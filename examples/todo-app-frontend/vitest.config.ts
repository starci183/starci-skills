import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Mirrors tsconfig.json's own "@/*": ["./src/*"] path mapping. Every existing spec that reaches a
// module under `@/...` did so only through an `import type` (erased before runtime) or transitively
// through a module that never got vi.mock'd - useSignIn.spec.ts is the first spec to import `@/...`
// at runtime and to vi.mock() it, which is what surfaced the missing alias here.
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  esbuild: {
    jsx: 'automatic',
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.spec.{ts,tsx}'],
    setupFiles: ['./vitest.setup.ts'],
    globals: false,
  },
});
