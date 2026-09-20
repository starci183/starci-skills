/** @type {import('jest').Config} */
module.exports = {
  rootDir: 'src',
  testEnvironment: 'node',
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/../tsconfig.json' }],
  },
  testRegex: '.*\\.spec\\.ts$',
  moduleFileExtensions: ['ts', 'js', 'json'],
  moduleNameMapper: {
    '^@modules/(.*)$': '<rootDir>/modules/$1',
    '^@features/(.*)$': '<rootDir>/features/$1',
    '^@tests/(.*)$': '<rootDir>/tests/$1',
  },
  // v8 coverage: istanbul instruments the TypeScript-emitted helper machinery (__decorate, __param,
  // __awaiter, esModuleInterop wrappers) as thousands of uncoverable "branches" — 4254 of the 6127
  // istanbul-counted branches sit on emitted code at source lines <=6, which no spec can ever cover.
  // v8 measures branches in the actual source (2910 real branches), so this number is honest.
  coverageProvider: 'v8',
  coverageDirectory: '<rootDir>/../coverage',
  collectCoverageFrom: [
    '**/*.ts',
    '!**/*.spec.ts',
    '!**/*.e2e-spec.ts',
    '!main.ts',
    '!tests/**',
    '!**/node_modules/**',
    '!**/dist/**',
  ],
  coverageReporters: ['text', 'lcov', 'json-summary'],
};
