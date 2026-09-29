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
 * The whole jest config of a Nest repository: one `unit` project and one `e2e` project.
 *
 * @param {object} options
 * @param {string} [options.tsconfig]            ts-jest tsconfig, default `tsconfig.json`
 * @param {Record<string,string|string[]>} [options.moduleNameMapper]  path aliases for both projects
 * @param {string[]} [options.roots]             default `<rootDir>/src`, `<rootDir>/apps`
 * @param {object} [options.unit]                extra jest project options for unit (setupFiles, ...)
 * @param {object} [options.e2e]                 extra jest project options for e2e (globalSetup, ...)
 */
function starciJestConfig(options = {}) {
  const tsconfig = options.tsconfig ?? "tsconfig.json"
  const shared = {
    preset: "ts-jest",
    testEnvironment: "node",
    rootDir: options.rootDir ?? ".",
    roots: options.roots ?? ["<rootDir>/src", "<rootDir>/apps"],
    moduleNameMapper: options.moduleNameMapper ?? {},
    transform: transform(tsconfig),
  }
  const live = process.env.E2E_LIVE === "1"
  return {
    testTimeout: 120_000,
    collectCoverageFrom: collectCoverageFrom(),
    coverageDirectory: "coverage",
    coverageReporters: ["lcov", "text-summary"],
    projects: [
      {
        ...shared,
        displayName: "unit",
        clearMocks: true,
        testMatch: ["**/*.spec.ts"],
        testPathIgnorePatterns: ["/node_modules/", "\.e2e-spec\.ts$", "[\\/]src[\\/]tests[\\/]e2e[\\/]"],
        ...options.unit,
      },
      {
        ...shared,
        displayName: "e2e",
        maxWorkers: 1,
        testMatch: ["<rootDir>/src/tests/e2e/**/*.e2e-spec.ts"],
        testPathIgnorePatterns: live ? ["/node_modules/"] : ["/node_modules/", "[\\/]src[\\/]tests[\\/]e2e[\\/]live[\\/]"],
        ...options.e2e,
      },
    ],
  }
}

module.exports = {
  starciJestConfig,
  mock,
  createMock,
  collectCoverageFrom,
  sonarCoverageExclusions,
  sonarExclusions,
  COVERAGE_SOURCES,
  COVERAGE_EXCLUDES,
}
