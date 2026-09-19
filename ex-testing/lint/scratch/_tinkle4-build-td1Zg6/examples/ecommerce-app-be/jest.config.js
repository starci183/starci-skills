/** @type {import('jest').Config} */
module.exports = {
  rootDir: '.',
  testEnvironment: 'node',
  roots: ['<rootDir>/apps', '<rootDir>/src'],
  transform: {
    // Relative to rootDir on purpose: the alias-parity checker resolves this string against
    // rootDir itself and cannot expand a `<rootDir>` token, so the token form reads as a
    // different TypeScript project than the declared `tsconfig.json` even when it is the same file.
    '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
  },
  testRegex: '.*\\.spec\\.ts$',
  moduleFileExtensions: ['ts', 'js', 'json'],
  moduleNameMapper: {
    '^@modules/(.*)$': '<rootDir>/src/modules/$1',
    '^@features/(.*)$': '<rootDir>/src/features/$1',
    '^@tests/(.*)$': '<rootDir>/src/tests/$1',
  },
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
