"use strict"

const { mock, createMock } = require("./mock.cjs")

/**
 * What Sonar counts as production code, expressed once. `sonarCoverageExclusions` renders the same list for
 * `sonar.coverage.exclusions`, so the jest denominator and the Sonar denominator cannot drift.
 *
 * Sonar side (canon sonar-project.properties): sources = src,apps; exclusions = specs, e2e specs, dist, coverage;
 * coverage.exclusions = src/tests/**, e2e specs, entrypoints and declaration files.
 */
const COVERAGE_SOURCES = ["src/**/*.ts", "apps/**/*.ts"]
/** Sonar `sonar.exclusions`: not analysed at all, so neither counted nor covered. */
const SONAR_EXCLUSIONS = ["**/*.spec.ts", "**/*.e2e-spec.ts", "**/dist/**", "**/coverage/**"]
/** Sonar `sonar.coverage.exclusions`: analysed, but outside the coverage denominator. */
const COVERAGE_ONLY_EXCLUSIONS = ["src/tests/**", "**/*.d.ts", "**/main.ts"]
const COVERAGE_EXCLUDES = [...SONAR_EXCLUSIONS, ...COVERAGE_ONLY_EXCLUSIONS]

function collectCoverageFrom() {
  return [...COVERAGE_SOURCES, ...COVERAGE_EXCLUDES.map((glob) => `!${glob}`)]
}

/** The `sonar.coverage.exclusions` value that matches `collectCoverageFrom`; `sonar.exclusions` is `sonarExclusions()`. */
function sonarCoverageExclusions() {
  return COVERAGE_ONLY_EXCLUSIONS.join(",")
}

function sonarExclusions() {
  return SONAR_EXCLUSIONS.join(",")
}

const TS_TRANSFORM = String.raw`^.+\.ts$`

/**
 * ts-jest without a type check (`diagnostics: false`; `isolatedModules: true` comes from @starci/tsconfig, which is where
 * ts-jest 29.4 reads it — the ts-jest option of the same name is deprecated): types are checked once, by `typecheck` / `typecheck:e2e`, never per test file.
 * `npm run test:e2e` must be `npm run typecheck:e2e && jest --selectProjects e2e` so nobody runs e2e on code that
 * does not type-check.
 */
function transform(tsconfig) {
  return { [TS_TRANSFORM]: ["ts-jest", { tsconfig, diagnostics: false }] }
}

/**
 * The path aliases of a StarCi back end: the same three `paths` the managed `tsconfig.json` declares, so jest resolves what
 * `tsc` resolves. They are part of the preset, not an option: a repository has no other alias.
 */
const MODULE_NAME_MAPPER = Object.freeze({
  "^@features/(.*)$": "<rootDir>/src/features/$1",
  "^@modules/(.*)$": "<rootDir>/src/modules/$1",
  "^@tests/(.*)$": "<rootDir>/src/tests/$1",
})

/**
 * The whole jest config of a Nest repository: one `unit` project and one `e2e` project. It takes no options: the
 * repository's `jest.config.js` is a managed file (R05), rendered by `hfs sync` as
 * `module.exports = require("@starci/jest-preset").starciJestConfig()`, so there is nothing a repository could tune.
 *
 * `src/tests/e2e/live/` is never part of the e2e project; `test:e2e:live` selects it explicitly.
 * Coverage uses v8: istanbul instruments the helpers TypeScript emits (`__decorate`, `__param`, `__awaiter`, interop wrappers)
 * as thousands of branches no spec can cover, while v8 measures the real source.
 */
function starciJestConfig() {
  const shared = {
    preset: "ts-jest",
    testEnvironment: "node",
    rootDir: ".",
    roots: ["<rootDir>/src", "<rootDir>/apps"],
    moduleNameMapper: { ...MODULE_NAME_MAPPER },
    transform: transform("tsconfig.json"),
  }
  return {
    testTimeout: 120_000,
    coverageProvider: "v8",
    collectCoverageFrom: collectCoverageFrom(),
    coverageDirectory: "coverage",
    coverageReporters: ["lcov", "text-summary"],
    projects: [
      {
        ...shared,
        displayName: "unit",
        clearMocks: true,
        testMatch: ["**/*.spec.ts"],
        testPathIgnorePatterns: ["/node_modules/", String.raw`\.e2e-spec\.ts$`, String.raw`[\\/]src[\\/]tests[\\/]e2e[\\/]`],
      },
      {
        ...shared,
        displayName: "e2e",
        maxWorkers: 1,
        testMatch: ["<rootDir>/src/tests/e2e/**/*.e2e-spec.ts"],
        testPathIgnorePatterns: ["/node_modules/", String.raw`[\\/]src[\\/]tests[\\/]e2e[\\/]live[\\/]`],
      },
    ],
  }
}

module.exports = {
  starciJestConfig,
  MODULE_NAME_MAPPER,
  mock,
  createMock,
  collectCoverageFrom,
  sonarCoverageExclusions,
  sonarExclusions,
  COVERAGE_SOURCES,
  COVERAGE_EXCLUDES,
}
