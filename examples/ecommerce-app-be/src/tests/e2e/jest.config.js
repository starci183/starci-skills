/**
 * Jest config for the e2e suite: `npx jest --config src/tests/e2e/jest.config.js`.
 *
 * .js rather than jest.config.ts on purpose: jest only loads a .ts config through ts-node, which
 * this repository does not depend on. The transform is still ts-jest on the app's own tsconfig, so
 * specs are full TypeScript - only the config file itself is CommonJS.
 *
 * @type {import('jest').Config}
 */
module.exports = {
  rootDir: '../../..',
  testEnvironment: 'node',
  roots: ['<rootDir>/src/tests/e2e'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
  },
  testMatch: ['**/*.e2e-spec.ts'],
  // Each spec boots its own compose project + both api processes; 120s covers a cold boot.
  testTimeout: 120_000,
  moduleFileExtensions: ['ts', 'js', 'json'],
  moduleNameMapper: {
    '^@e2e-kit/(.*)$': '<rootDir>/../../packages/e2e-kit/src/$1',
    '^@modules/(.*)$': '<rootDir>/src/modules/$1',
    '^@features/(.*)$': '<rootDir>/src/features/$1',
    '^@tests/(.*)$': '<rootDir>/src/tests/$1',
  },
  // Run-owned stacks are already isolated per spec; serial workers keep docker off its knees.
  maxWorkers: 1,
};
