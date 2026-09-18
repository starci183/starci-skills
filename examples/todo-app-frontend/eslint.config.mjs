import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import starciFe, { recommended as starciFeRecommended, linterOptions as starciFeLinterOptions } from '@starci/eslint-canon-fe';

/**
 * The StarCi FE canon governs every production TypeScript/TSX source under this app's own `src` tree and
 * its local `packages/*` libraries - the same shape `architecture.json` and the code-pattern profile
 * already describe. `starci-fe`'s recommended rule map and linter options are adopted as-is; only the
 * `files` glob is widened to this repository's actual layout, and the legacy filename-twin heuristic is
 * switched off for connected blocks per NEXT-LEGACY-BLOCK-TWIN-GUARD (the conditional world-owner
 * architecture check replaces it).
 */
const canonFiles = ['src/**/*.{ts,tsx}', 'packages/*/src/**/*.{ts,tsx}', '*.ts'];

export default [
  {
    files: canonFiles,
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    linterOptions: starciFeLinterOptions,
    plugins: { 'starci-fe': starciFe, '@typescript-eslint': tsPlugin },
    rules: {
      ...starciFeRecommended,
      '@typescript-eslint/array-type': ['error', { default: 'generic', readonly: 'generic' }],
    },
  },
  {
    files: ['src/components/blocks/**/index.tsx'],
    rules: {
      'starci-fe/connected-block-has-presentational-twin': 'off',
    },
  },
];
