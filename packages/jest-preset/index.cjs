"use strict"

const { mock, createMock } = require("./mock.cjs")
const { mockEntityManager, fakeTransaction } = require("./entity-manager.cjs")
const { FakeClock } = require("./clock.cjs")
const { fakeCache } = require("./cache.cjs")
const { fakeLock } = require("./lock.cjs")
const { recordingOutbox } = require("./outbox.cjs")
const { builder } = require("./builders.cjs")
const { fakeIds, FakeIds } = require("./ids.cjs")

/**
 * Coverage is measured where logic runs: every service (the one place business logic lives, owner-locked unit standard) and
 * every cli command of the cli feature root (`src/features/cli/**` + `/*.cli.ts`: an action runner, R134). Handlers, resolvers,
 * controllers and consumers are thin, and helpers called by a service are covered through the service's own spec, so the
 * services and the cli commands under `src` are the whole denominator and every file in it must reach 100 on every metric.
 * The unit run also writes `coverage/lcov.info`: Sonar imports it (`sonar.javascript.lcov.reportPaths`) with the same scope
 * (`sonar.coverage.exclusions` holds every other file, rendered by hfs sync) and its quality gate holds coverage at 100 on those files.
 */
const COVERAGE_SOURCES = ["src/**/*.service.ts", "src/features/cli/**/*.cli.ts"]
const COVERAGE_EXCLUDES = ["src/tests/**", "**/dist/**", "**/coverage/**"]
/** The four metrics, each held at 100 per file. */
const COVERAGE_THRESHOLD = Object.freeze({ lines: 100, branches: 100, functions: 100, statements: 100 })

function collectCoverageFrom() {
  return [...COVERAGE_SOURCES, ...COVERAGE_EXCLUDES.map((glob) => `!${glob}`)]
}

/** Sonar `sonar.exclusions`: specs, e2e specs, dist and coverage output are not analysed at all. */
const SONAR_EXCLUSIONS = ["**/*.spec.ts", "**/*.e2e-spec.ts", "**/dist/**", "**/coverage/**"]

function sonarExclusions() {
  return SONAR_EXCLUSIONS.join(",")
}

const TS_TRANSFORM = String.raw`^.+\.ts$`

/**
 * ts-jest without a type check (`diagnostics: false`; `isolatedModules: true` comes from @starci/tsconfig, which is where
 * ts-jest 29.4 reads it — the ts-jest option of the same name is deprecated): types are checked once, by `typecheck` / `typecheck:tests`, never per test file.
 * `npm run test:e2e` (and `test:integration`, `test:contract`) runs `npm run typecheck:tests` first so nobody runs a world spec on code that
 * does not type-check.
 */
function transform(tsconfig) {
  return { [TS_TRANSFORM]: ["ts-jest", { tsconfig, diagnostics: false }] }
}

/**
 * The compiler options the UNIT project overlays on the repository tsconfig (ts-jest merges an inline `tsconfig` object over the
 * `tsconfig.json` it finds under `rootDir`). They exist so that per-file 100 coverage is reachable for a decorated service:
 *  - `isolatedModules: false`: with it on, TypeScript cannot tell whether an imported name is a class, and emits a
 *    `typeof (_a = typeof Dep !== "undefined" && Dep) === "function" ? _a : Object` guard per class-typed constructor parameter for
 *    `design:paramtypes`; the `Object` arm can never run, so the branch stays uncovered. With the full language service the
 *    metadata is emitted as plain `Dep`.
 *  - `importHelpers: true`: the decorator helpers (`__decorate`, `__param`, `__metadata`) come from `tslib`, not inlined per file
 *    with branches of their own. The repository lists `tslib` in its devDependencies.
 * Integration, e2e and contract keep the repository setting: they measure nothing.
 */
const UNIT_COMPILER_OPTIONS = Object.freeze({ isolatedModules: false, importHelpers: true })

function unitTransform() {
  return transform({ ...UNIT_COMPILER_OPTIONS })
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

/** The test folders under `src/tests/` that a project other than `unit` owns (owner test layout 2026-09-30). */
const TEST_KIND_FOLDERS = Object.freeze(["world", "integration", "e2e", "contract"])
const underTests = (folder) => String.raw`[\\/]src[\\/]tests[\\/]` + folder + String.raw`[\\/]`

/**
 * The whole jest config of a Nest repository: projects `unit` (colocated `<name>.spec.ts`), `integration`
 * (`src/tests/integration/<capability>/<name>.integration-spec.ts`), `e2e` (`src/tests/e2e/<area>/<name>.e2e-spec.ts`) and
 * `contract` (`src/tests/contract/<provider>/<name>.contract-spec.ts`). It takes no options: the repository's `jest.config.js` is a managed file
 * (R05), rendered by `hfs sync` as `module.exports = require("@starci/jest-preset").starciJestConfig()`.
 *
 * The managed scripts select one project each (`test` = unit, `test:integration`, `test:e2e`, `test:contract`); the
 * contract project is never part of `test` or `test:e2e`, and a contract spec skips itself without sandbox config. The
 * test tree compiles against `src/tests/tsconfig.json`, the nearest config of every file under `src/tests/`. The
 * integration, e2e and contract projects share the world's `global-setup.ts`/`global-teardown.ts` (`src/tests/world/`) and
 * run their spec files up to `min(--maxWorkers, slots)` at once, each in a worker process of its own bound to one data slot
 * of the test world (`world-runner.cjs`; a slot's data is reset when a file boots, so no two files ever share a slot); the unit project alone has a `setupFilesAfterEnv` (the Outcome matchers).
 * Coverage is collected from every `*.service.ts` only, with a per-file threshold of 100 on lines, branches, functions and
 * statements: the `test` script runs the unit project with `--coverage`, fails below it and writes `coverage/lcov.info` for Sonar. It uses v8: istanbul instruments the helpers TypeScript emits (`__decorate`, `__param`, `__awaiter`, interop wrappers)
 * as thousands of branches no spec can cover, while v8 measures the real source.
 */
/** The runner of the integration, e2e and contract projects: one fresh worker process per spec file. */
const WORLD_RUNNER = require.resolve("./world-runner.cjs")

/** True when the repository at `root` has the test world's global setup (`src/tests/world/global-setup.ts`). */
function hasTestWorld(root) {
  return require("node:fs").existsSync(require("node:path").join(root, "src", "tests", "world", "global-setup.ts"))
}

/**
 * True when the repository at `root` holds a file of the coverage source `glob` (`<dir>/**` + `/*.<role>.ts`): jest refuses a
 * threshold key that matches no covered file, and a back end may have no cli command yet, so a role without files gets no key
 * (its files, once added, are measured and held at 100 like every other).
 */
function hasCoverageSubjects(root, glob) {
  const fsx = require("node:fs")
  const pathx = require("node:path")
  const base = glob.slice(0, glob.indexOf("**")).replace(/\/$/, "")
  const suffix = glob.slice(glob.lastIndexOf("*") + 1)
  const walk = (dir) => {
    let entries
    try { entries = fsx.readdirSync(dir, { withFileTypes: true }) } catch { return false }
    return entries.some((entry) => (entry.isDirectory() ? !["node_modules", "dist", "coverage"].includes(entry.name) && walk(pathx.join(dir, entry.name)) : entry.name.endsWith(suffix)))
  }
  return walk(pathx.join(root, base))
}

function starciJestConfig() {
  const shared = {
    preset: "ts-jest",
    testEnvironment: "node",
    rootDir: ".",
    roots: ["<rootDir>/src", "<rootDir>/apps"],
    moduleNameMapper: { ...MODULE_NAME_MAPPER },
  }
  const suite = (displayName, suffix) => ({
    ...shared,
    transform: transform("src/tests/tsconfig.json"),
    displayName,
    // Every spec file in a process of its own (never in band): nothing one file or the globalSetup put on a process global
    // (a framework registry such as @nestjs/graphql's type metadata) reaches another file. See world-runner.cjs.
    runner: WORLD_RUNNER,
    testMatch: [`<rootDir>/src/tests/${displayName}/**/*.${suffix}.ts`],
    // The one test world: started once per run of a project that has a test to run, torn down after it.
    globalSetup: "<rootDir>/src/tests/world/global-setup.ts",
    globalTeardown: "<rootDir>/src/tests/world/global-teardown.ts",
  })
  return {
    testTimeout: 120_000,
    coverageProvider: "v8",
    collectCoverageFrom: collectCoverageFrom(),
    // A glob key is applied to every matching file on its own: each service file must reach 100, not the average.
    coverageThreshold: Object.fromEntries(COVERAGE_SOURCES.filter((glob) => hasCoverageSubjects(process.cwd(), glob)).map((glob) => [`./${glob}`, { ...COVERAGE_THRESHOLD }])),
    coverageDirectory: "coverage",
    // lcov is what Sonar imports (coverage/lcov.info); text-summary and text are what the developer reads.
    coverageReporters: ["text-summary", "text", "lcov"],
    projects: [
      {
        ...shared,
        transform: unitTransform(),
        displayName: "unit",
        clearMocks: true,
        // The Outcome matchers (`toBeRefused`, `toSucceedWith`) exist in the unit project only.
        setupFilesAfterEnv: [require.resolve("./matchers.cjs")],
        testMatch: ["**/*.spec.ts"],
        testPathIgnorePatterns: ["/node_modules/", ...TEST_KIND_FOLDERS.map(underTests)],
      },
      // The integration, e2e and contract projects exist only where the repository has its test world: jest validates
      // every project's globalSetup even under --selectProjects unit, so a repository whose world is not written yet
      // would otherwise fail to run its unit specs with the managed config.
      ...(hasTestWorld(process.cwd()) ? [suite("integration", "integration-spec"), suite("e2e", "e2e-spec"), suite("contract", "contract-spec")] : []),
    ],
  }
}

module.exports = {
  starciJestConfig,
  TEST_KIND_FOLDERS,
  MODULE_NAME_MAPPER,
  mock,
  createMock,
  mockEntityManager,
  fakeTransaction,
  FakeClock,
  fakeCache,
  fakeLock,
  recordingOutbox,
  builder,
  fakeIds,
  FakeIds,
  collectCoverageFrom,
  sonarExclusions,
  COVERAGE_SOURCES,
  hasCoverageSubjects,
  COVERAGE_EXCLUDES,
  COVERAGE_THRESHOLD,
  UNIT_COMPILER_OPTIONS,
  WORLD_RUNNER,
}
