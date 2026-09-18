const os = require('node:os');
const path = require('node:path');

/**
 * The end-to-end project's own Jest config. Kept separate from the backend's `jest.config.js` on purpose:
 * the unit suite is an in-process suite with fakes and a `@nivo/utils` path alias, and this one is a
 * black-box HTTP suite that must not import product source at all. `npm test` never runs these files and
 * `npm run test:e2e` never runs those.
 */
module.exports = {
  rootDir: path.resolve(__dirname, '..', '..'),
  // A root-relative glob, not `<rootDir>/...`: jest's substitution leaves a mixed-separator pattern on
  // Windows that micromatch then matches nothing against.
  roots: ['<rootDir>/test/e2e'],
  testEnvironment: 'node',
  testMatch: ['**/scenarios/**/*.e2e-spec.js'],
  // One worker, always: every scenario in this suite talks to the single run-owned stack the runner
  // started, and the erasure scenarios are destructive to a shared persona on purpose.
  maxWorkers: 1,
  testTimeout: 300000,
  verbose: true,
  cacheDirectory: path.join(os.tmpdir(), 'todo-app-e2e-jest-cache'),
};
