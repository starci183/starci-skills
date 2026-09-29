const os = require('node:os');
const path = require('node:path');

/**
 * One root Jest config with exactly two projects (HFS test kinds):
 *   unit - `<name>.spec.ts` beside its subject, in-process with fakes; `npm run test:unit`.
 *   e2e  - `*.e2e-spec.ts` under src/tests/e2e/ (environment code in src/tests/e2e/setup/, data in
 *          src/tests/fixtures/); each spec boots real infra (TestingInfraModule) and talks to it over
 *          HTTP; `npm run test:e2e`, serial (`--runInBand`, set by the script).
 *
 * @type {import('jest').Config}
 */
const shared = {
  rootDir: '.',
  testEnvironment: 'node',
  transform: {
    '^.+\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
  // The shared e2e-kit source lives outside this repository root; its axios/graphql/apollo imports resolve here.
  modulePaths: ['<rootDir>/node_modules'],
  moduleNameMapper: {
    '^@e2e-kit/(.*)$': '<rootDir>/../../packages/e2e-kit/src/$1',
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
      testMatch: ['**/*.spec.ts'],
      testPathIgnorePatterns: ['/node_modules/', '/dist/', '\.e2e-spec\.ts$'],
    },
    {
      ...shared,
      displayName: 'e2e',
      // A root-relative glob, not `<rootDir>/...`: jest's substitution leaves a mixed-separator pattern
      // on Windows that micromatch then matches nothing against.
      roots: ['<rootDir>/src/tests/e2e'],
      testMatch: ['**/*.e2e-spec.ts'],
      // 120s test timeout: src/tests/e2e/setup/jest.setup.ts.
      setupFilesAfterEnv: ['<rootDir>/src/tests/e2e/setup/jest.setup.ts'],
      cacheDirectory: path.join(os.tmpdir(), 'todo-app-e2e-jest-cache'),
    },
  ],
  // v8 coverage: istanbul instruments the TypeScript-emitted helper machinery (__decorate, __param,
  // __awaiter, esModuleInterop wrappers) as thousands of uncoverable "branches" — 4254 of the 6127
  // istanbul-counted branches sit on emitted code at source lines <=6, which no spec can ever cover.
  // v8 measures branches in the actual source (2910 real branches), so this number is honest.
  coverageProvider: 'v8',
  coverageDirectory: '<rootDir>/coverage',
  collectCoverageFrom: [
    'src/**/*.ts',
    'apps/**/*.ts',
    '!src/**/*.spec.ts',
    '!src/**/*.e2e-spec.ts',
    '!apps/**/*.spec.ts',
    '!apps/**/main.ts',
    '!src/tests/**',
    '!**/node_modules/**',
    '!**/dist/**',
  ],
  coverageReporters: ['text', 'lcov', 'json-summary'],
};
