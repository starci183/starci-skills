/** @type {import('jest').Config} */
module.exports = {
  rootDir: '.',
  testEnvironment: 'node',
  transform: {
    '^.+\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }],
  },
  testRegex: '.*\.spec\.ts$',
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '<rootDir>/src/tests/e2e/'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  moduleNameMapper: {
    '^@modules/(.*)$': '<rootDir>/src/modules/$1',
    '^@features/(.*)$': '<rootDir>/src/features/$1',
    '^@tests/(.*)$': '<rootDir>/src/tests/$1',
  },
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
