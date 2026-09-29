/**
 * One root Jest config with exactly two projects (HFS test kinds):
 *   unit - `<name>.spec.ts` beside its subject; `npm run test:unit`.
 *   e2e  - `*.e2e-spec.ts` under src/tests/e2e/ (environment code in src/tests/e2e/setup/, data in
 *          src/tests/fixtures/); `npm run test:e2e`. Each spec boots its own compose project + both api
 *          processes, so run it serially (`--runInBand`, set by the script).
 *
 * .js rather than jest.config.ts on purpose: jest only loads a .ts config through ts-node, which
 * this repository does not depend on. The transform is still ts-jest on the app's own tsconfig, so
 * specs are full TypeScript - only the config file itself is CommonJS.
 *
 * @type {import('jest').Config}
 */
const shared = {
  rootDir: '.',
  testEnvironment: 'node',
  transform: {
    // Relative to rootDir on purpose: the alias-parity checker resolves this string against
    // rootDir itself and cannot expand a `<rootDir>` token, so the token form reads as a
    // different TypeScript project than the declared `tsconfig.json` even when it is the same file.
    '^.+\.ts$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
  moduleNameMapper: {
    '^@e2e-kit/(.*)$': '<rootDir>/../../packages/e2e-kit/src/$1',
    '^ecommerce-app-be/features/(.*)$': '<rootDir>/src/features/$1/index.ts',
    '^ecommerce-app-be/modules/(.*)$': '<rootDir>/src/modules/$1/index.ts',
    '^@modules/(.*)$': '<rootDir>/src/modules/$1',
    '^@features/(.*)$': '<rootDir>/src/features/$1',
    '^@tests/(.*)$': '<rootDir>/src/tests/$1',
  },
};

module.exports = {
  projects: [
    {
      ...shared,
      displayName: 'unit',
      roots: ['<rootDir>/apps', '<rootDir>/src'],
      testMatch: ['**/*.spec.ts'],
      testPathIgnorePatterns: ['/node_modules/', '/dist/', '\.e2e-spec\.ts$'],
    },
    {
      ...shared,
      displayName: 'e2e',
      roots: ['<rootDir>/src/tests/e2e'],
      testMatch: ['**/*.e2e-spec.ts'],
      // Each spec boots its own compose project + both api processes; the 120s timeout lives in the setup file.
      setupFilesAfterEnv: ['<rootDir>/src/tests/e2e/setup/jest.setup.ts'],
    },
  ],
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.ts',
    'apps/**/*.ts',
    '!src/**/*.spec.ts',
    '!apps/**/*.spec.ts',
    '!**/*.e2e-spec.ts',
    '!**/main.ts',
    '!src/tests/**',
    '!**/node_modules/**',
    '!**/dist/**',
  ],
  coverageReporters: ['text', 'lcov', 'json-summary'],
};
