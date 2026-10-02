# Changelog

## Unreleased

- Breaking (contract change `coverage-modules-logic`): `starciJestConfig({ coverage: { roots, roles, excludes } })` takes the coverage scope the managed `be/jest.config.js` renders (`hfs sync`, from the `coverage` field of the slot manifest and `ruleParams.be.logicRoles`, through `scripts/hfs/coverage-scope.mjs`), and refuses to run without it. `COVERAGE_SOURCES` is deleted: per-file 100 now holds on every logic role (service, policy, projection, guard, mapper, client, filter, interceptor, processor, step, saga, saga-step, compensation, consumer, webhook) inside the measured roots (the logic of `be/src/modules`), never on `be/src/features` (thin by R203). New exports `rootGlob` and `StarciCoverageScope`; `collectCoverageFrom(coverage)` and `hasCoverageSubjects(root, glob)` take a scope and a glob with `**` and `{a,b}`.
- New: `fakeInbox()` (also `@starci/jest-preset/inbox`), the twin of `recordingOutbox()` for the delivery side: `claim` answers true for the first call of a (source, eventId) pair and false afterwards, `release` gives the claim back, `seen` marks a redelivery, and `claims`, `claimed`, `released`, `failNext` and `clear` let a spec assert what a consumer or a signed webhook did. A spec no longer stubs `mock<Inbox>()` by hand.

## 2.2.4 - 2026-10-02

- Changed: the world runner runs up to `min(--maxWorkers, slots)` files of the integration, e2e and contract projects at once,
  each still in a fresh process of its own (never in band), each bound to one data slot of `@starci/test-world` 1.1.0: the
  file's process is forked with `STARCI_TEST_WORLD_SLOT=<k>`, and no two files ever hold one slot at the same time. The slot
  count is the one the world's globalSetup published in its state file. This lifts the 2.2.0 limitation "one file at a time".
- Changed: the runner reads test-world state protocol 2 only. A missing state file or another protocol fails the run with
  `JEST_PRESET_WORLD_PAIR_MISMATCH`, naming this preset, the test-world that wrote the file and the fix (pin both together per
  knowledge/hfs/canon-pins.yaml); there is no fallback mode.
## Unreleased

- Removed (breaking): `recordingOutbox()` and the `./outbox` entry, superseded by the event bus and the queue outbox. Added `recordingEventBus()` (the `EventBus` port: `publish(event, tx)`, scripted pending retries, dead letters and one-shot failures) and `recordingQueueOutbox()` (the `QueueOutbox` port: `write(tx, queue, payload)`), each recording whether `tx` was a `fakeTransaction` manager, and the `./event-bus` and `./queue` entries. Contract change `patterns-event-bus`.

## 2.2.2 - 2026-10-01

- Changed: the coverage reporters are `text-summary`, `text` and `lcov`. The unit run writes `coverage/lcov.info`, which Sonar (`sonar.javascript.lcov.reportPaths`) and Codecov import with the scope `hfs sync` renders from `COVERAGE_SOURCES` (services only). Coverage is still collected from `src/**/*.service.ts` only, with the per-file threshold of 100. Contract change `sonar-services-coverage`.

## 2.2.1 - 2026-10-01

- Changed: declares its test toolchain as devDependencies and @jest/globals as an optional peer, with a lockfile (lane PKGT clean proof); no preset change. The published package.json differs from 2.2.0, so the version moves.

## 2.2.0 - 2026-10-01

- Fixed: in one `npm run test:e2e` every e2e file after the first failed to boot with "Cannot determine a GraphQL output type":
  `@nestjs/graphql` keeps its type registry on the process global, the test world's globalSetup loads application code in jest's
  main process, and jest-environment-node exposes the host process's globals to every file it runs there (or in a reused worker).
  The integration, e2e and contract projects now run on the preset's world runner (`runner: WORLD_RUNNER`, `world-runner.cjs`):
  every spec file in a fresh worker process, never in band (not even with `--runInBand` or one
  test), so each file boots clean whatever framework keeps state on a global. The runner drives the stock jest-runner of the jest
  that loads it (jest -> @jest/core -> jest-runner), one single-worker farm per file.
- Changed: the world runner runs the files of the integration, e2e and contract projects ONE AT A TIME, enforced by the runner
  (`--maxWorkers` is not honoured there): every file shares the run's data and the test world resets it when a file boots, so
  two files at once would wipe each other's state. The project-level `maxWorkers: 1` is removed: it is a global jest option a
  project config never applied (so e2e files used to run cores-1 at a time).
- Known limitation (lifted in alpha.5): world files cannot run in parallel until each worker has its own data namespace (a
  database schema, a Keycloak realm prefix, a Redis key prefix and its own fakes per worker).
- Added: `WORLD_RUNNER` (the runner's resolved path) on the package root.

## 2.1.1 - 2026-10-01

- Fixed: a repository without its test world (`src/tests/world/global-setup.ts`) could not run its unit specs with the managed `jest.config.js`: jest validates every project's `globalSetup`, even under `--selectProjects unit`. The integration, e2e and contract projects are now declared only when the world exists.

## 2.1.0 - 2026-09-30

- Added: the claim side of `recordingOutbox()`, so a claim-side consumer is specced with the kit double the `OUTBOX` token requires (`spec-infra-double-from-kit`) instead of `mock<Outbox>()`. `queueRecords(...records)` fills a backlog that `claimDue(params)` hands out in order (only the asked queues, at most `limit`, removed once claimed; an empty backlog is an empty claim, a record queued twice is a duplicate delivery), `failNext(operation, error)` makes the next `enqueue`, `claimDue`, `complete`, `retry` or `bury` reject once, and `claims`, `completed`, `retried`, `buried` and `backlog` expose what happened. `RecordingOutbox<M, R>` takes the claimed record type as a second parameter; `ClaimedRecord`, `ClaimParams`, `RetryParams`, `BuryParams` and `OutboxOperation` are exported from `./outbox`. `clear()` resets the claim side too. No breaking change.

## 2.0.0 - 2026-09-30

- Breaking: `starciJestConfig()` takes no options. The repository `jest.config.js` is a managed file, exactly `module.exports = require("@starci/jest-preset").starciJestConfig()`, rendered by `hfs sync` and compared by `hfs check` (HFS_MANAGED_FILE_DRIFT), so `moduleNameMapper`, `roots`, `tsconfig`, `rootDir`, `unit` and `e2e` overrides are gone. `StarciJestOptions` is removed.
- Added: the three path aliases (`@features/*`, `@modules/*`, `@tests/*`) are part of the preset (`MODULE_NAME_MAPPER`), matching the aliases the managed `tsconfig.json` declares.
- Added: `coverageProvider: "v8"`, so branch coverage counts real source, not the helpers TypeScript emits.
- Breaking: four projects, one per test kind (owner test layout 2026-09-30): `unit` (colocated `*.spec.ts`, ignores `src/tests/{world,integration,e2e,contract}/`), `integration` (`src/tests/integration/**/*.integration-spec.ts`), `e2e` (`src/tests/e2e/**/*.e2e-spec.ts`) and `contract` (`src/tests/contract/**/*.contract-spec.ts`). The last three compile against `src/tests/tsconfig.json`, run one worker and share the test world's `globalSetup`/`globalTeardown` (`src/tests/world/global-setup.ts`, `global-teardown.ts`); there is no `setupFilesAfterEnv`. `src/tests/e2e/live/`, `E2E_LIVE` and `test:e2e:live` are gone: a provider sandbox is a contract spec. `typecheck:e2e` is replaced by `typecheck:tests`.
- Unchanged: ts-jest with `diagnostics: false` (`isolatedModules` comes from `@starci/tsconfig`), `mock<T>()` and `FakeClock`.
- Added (unit test standard, lane UT): the shared unit double kit on the package root, `mockEntityManager({ method: [Entity, result] })` (typed against the entity, `query: [sql, rows]`, a list of pairs for several answers, every method a `jest.fn`, any unstubbed method throws an error naming it, `create(Entity, plain)` works unstubbed), `fakeTransaction(em)` (`outcomes`, `commits`, `rollbacks`, `committedWrites`, `rolledBackWrites`), `fakeCache(clock)` (JSON round trip, TTL from the clock, `has`, `ttlOf`, `keys`, typed-key and cache-manager shapes), `fakeLock(clock)` (`acquire`, `release`, `isHeld`, `holderOf`, `fenceOf`), `recordingOutbox()` (`enqueue`, `messages`, `writes`, `entries` with `inTransaction`), `builder<T>(defaults)`, `fakeIds()` and the Outcome matchers `toBeRefused` and `toSucceedWith` (installed in the unit project through `setupFilesAfterEnv`). Sub-path exports `./cache`, `./lock`, `./outbox`, `./builders`, `./entity-manager`, `./ids` and `./matchers` were added next to `./mock` and `./clock`.
- Breaking: coverage is collected from `src/**/*.service.ts` only (minus `src/tests/**`, `dist`, `coverage`), with a per-file threshold of 100 on lines, branches, functions and statements (`coverageThreshold` glob key `./src/**/*.service.ts`); the managed `test` script runs the unit project with `--coverage`. The previous denominator (`src/**/*.ts` and `apps/**/*.ts`) is gone. The unit project overlays `isolatedModules: false` and `importHelpers: true` on the repository tsconfig (exported as `UNIT_COMPILER_OPTIONS`) so a decorated service can reach 100 (no `design:paramtypes` guard branches, no inlined decorator helpers); repositories list `tslib` in devDependencies.
- Breaking: `sonarCoverageExclusions()` is removed and coverage reporters are `text-summary` and `text` only (no `lcov`): Sonar does not depend on coverage and Codecov is not fed by the preset. `sonarExclusions()` remains and renders `sonar.exclusions`.
- Breaking (convention): a unit spec exists only as `<name>.service.spec.ts` beside a `*.service.ts` and builds the service with `Test.createTestingModule({ providers })`; `mockEntityManager()` and `fakeTransaction()` from `src/tests/fixtures/database.ts` are replaced by the kit of this package.
