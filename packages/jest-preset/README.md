# @starci/jest-preset

The jest config of a Nest repository and the one shared unit-test double kit (`mock<T>()`, `mockEntityManager`, `fakeTransaction`, `fakeCache`, `fakeLock`, `recordingOutbox`, `builder`, `FakeClock`, `fakeIds` and the Outcome matchers). Install it from the npm registry at the exact version in [`knowledge/hfs/canon-pins.yaml`](../../knowledge/hfs/canon-pins.yaml) (see [`packages/README.md`](../README.md)).

```js
// jest.config.js (a managed file: `hfs sync` renders it, `hfs check` compares it; do not edit)
module.exports = require("@starci/jest-preset").starciJestConfig()
```

`starciJestConfig()` takes no options: a repository has no jest setting to tune, so the file above is the whole config.

## What it sets

- **Four projects, one per test kind**: `unit` (`**/*.spec.ts`, which by the unit standard means one `<name>.service.spec.ts` beside each `*.service.ts`; `clearMocks`; the Outcome matchers are installed through `setupFilesAfterEnv`; ignores
  `src/tests/{world,integration,e2e,contract}/`), `integration` (`src/tests/integration/**/*.integration-spec.ts`), `e2e`
  (`src/tests/e2e/**/*.e2e-spec.ts`) and `contract` (`src/tests/contract/**/*.contract-spec.ts`). The last three compile against
  `src/tests/tsconfig.json`, start the one test world through `globalSetup`/`globalTeardown`
  (`src/tests/world/global-setup.ts`, `global-teardown.ts`) and run on the world runner (`world-runner.cjs`, `WORLD_RUNNER`): every
  spec file in a worker process of its own, `--maxWorkers` files at a time, never in band, so nothing the globalSetup or another
  file left on a process global (a framework registry such as `@nestjs/graphql`'s type metadata) reaches the file; outage specs are
  serialized by the test world's outage lock (`@starci/test-world`). Only the unit project has a `setupFilesAfterEnv`. The managed scripts select one
  project each: `test`, `test:integration`, `test:e2e`, `test:contract`; a contract spec skips itself without sandbox config.
- **The three path aliases** `@features/*`, `@modules/*`, `@tests/*` (`MODULE_NAME_MAPPER`), the same ones the managed `tsconfig.json` declares.
- **ts-jest with `diagnostics: false`** in every project. `isolatedModules: true` comes from `@starci/tsconfig` (ts-jest 29.4 reads it
  there; its own option is deprecated). Types are checked once, by `typecheck` (unit specs included) and `typecheck:tests`
  (`src/tests/tsconfig.json`), and `test:integration`/`test:e2e`/`test:contract` run `typecheck:tests` first, so no world spec
  runs on code that does not type-check.
- **Coverage of services only, per-file 100.** `collectCoverageFrom` is `src/**/*.service.ts` minus `src/tests/**`, `dist` and
  `coverage`, and `coverageThreshold` is `{ "./src/**/*.service.ts": { lines: 100, branches: 100, functions: 100, statements: 100 } }`,
  a glob key that applies to each file on its own, so every service must reach 100 on every metric (an average never passes). The
  managed `test` script runs the unit project with `--coverage` and fails below it. Coverage is measured by v8, which counts the
  real source. The unit project overlays `isolatedModules: false` and `importHelpers: true` on the repository tsconfig (ts-jest merges an
  inline `tsconfig` object over the `tsconfig.json` it finds): with `isolatedModules` on, TypeScript emits an unreachable
  `typeof Dep !== "undefined" ? Dep : Object` guard per class-typed constructor parameter, and inlined decorator helpers carry branches
  of their own, so 100 would be unreachable. The repository lists `tslib` in its devDependencies (`UNIT_COMPILER_OPTIONS`). Reporters are `text-summary` and
  `text`; there is no `lcov`.
- **Sonar does not read coverage.** `sonarCoverageExclusions()` and the lcov report are removed. `sonarExclusions()` still renders
  `sonar.exclusions` (`**/*.spec.ts,**/*.e2e-spec.ts,**/dist/**,**/coverage/**`); the quality gate fails on imported issues only.

## The unit standard in one page

Only services are unit-tested, through `Test.createTestingModule`, with the doubles of this package and nothing else:

```ts
import { Test } from "@nestjs/testing"
import { FakeClock, mockEntityManager } from "@starci/jest-preset"

const clock = new FakeClock("2026-01-01T00:00:00.000Z")
const entityManager = mockEntityManager({ findOne: [Accrual, null] })
const moduleRef = await Test.createTestingModule({
  providers: [
    CommissionService,
    { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },   // exactly the constructor dependencies
    { provide: CLOCK, useValue: clock },
  ],
}).compile()
const service = moduleRef.get(CommissionService)
```

No `new` of the service, no `imports`, no `overrideProvider`, no `jest.mock`, no casts, no `Date.now()` and no `process.env`. The
full rules and the dependency-to-double-to-cases table are `knowledge/patterns/be/test.yaml` (BE-TEST-1 to BE-TEST-15). Every
export below is on the package root (`@starci/jest-preset`); the sub-paths `./mock`, `./clock`, `./entity-manager`, `./ids`,
`./matchers`, `./cache`, `./lock`, `./outbox` and `./builders` exist as well.

## `mockEntityManager` and `fakeTransaction`

A strict, typed `EntityManager` double. Describe what the subject should see; every method is a `jest.fn`, and any method the
subject calls that the spec did not stub throws an error naming the method, so the absence of a stub proves the absence of that
database call. A wrong entity or SQL text throws too. `create(Entity, plain)` works without a stub.

```ts
import { mockEntityManager, fakeTransaction } from "@starci/jest-preset"

// [Entity, result], typed against the entity: `findOne: [Order, 5]` is a compile error
const em = mockEntityManager({ findOne: [Order, order], save: [Order, saved] })
expect(em.save).toHaveBeenCalledWith(expect.objectContaining({ status: "paid" }))

// a raw query: [sql, rows]
const reader = mockEntityManager({ query: ["select 1", [{ n: 1 }]] })

// lists: a list of pairs answers several calls in order
const two = mockEntityManager({ find: [[Order, [orderA]], [Order, [orderB]]] })

// a transaction: work runs with a scoped view; commits, rollbacks and writes are recorded
const tx = fakeTransaction(mockEntityManager({ save: [Order, saved] }))
await service.place(params)                       // service calls em.transaction(async (manager) => ...)
expect(tx.commits).toBe(1)
expect(tx.committedWrites).toHaveLength(1)        // after a throwing body: tx.rollbacks, tx.rolledBackWrites, tx.outcomes
```

The stubbable methods are `findOne`, `findOneBy`, `findOneOrFail`, `findOneByOrFail`, `find`, `findBy`, `findAndCount`,
`findAndCountBy`, `count`, `countBy`, `exists`, `existsBy`, `save`, `remove`, `softRemove`, `recover`, `insert`, `update`, `upsert`,
`delete`, `softDelete`, `restore`, `increment`, `decrement` and `query`. `fakeTransaction(em)` returns `{ em, outcomes, commits,
rollbacks, committedWrites, rolledBackWrites }`.

## `fakeCache(clock)`, `fakeLock(clock)` and `recordingOutbox()`

```ts
const clock = new FakeClock("2026-01-01T00:00:00.000Z")

const cache = fakeCache(clock)     // JSON round trip; TTL from the clock
await cache.set({ key, args: ["u1"], value: profile })   // the typed-key port: get/set/del({ key, args, value })
await cache.get({ key, args: ["u1"] })
await cache.set("raw-key", value, 60_000)                // the cache-manager shape: get(text), set(text, value, ttlMs)
cache.has({ key, args: ["u1"] })                          // a live entry exists
cache.ttlOf({ key, args: ["u1"] })                        // seconds left (rounded up), null when absent or expired
cache.keys()                                              // the texts of the live entries
clock.advance(301_000)                                    // entries with a 300 s TTL are now expired

const lock = fakeLock(clock)       // acquire, contention, release, expiry, growing fence
const grant = await lock.acquire({ name: "writer", holder: "a", ttlMs: 30_000 })   // null when held by another
lock.isHeld("writer"); lock.holderOf("writer"); lock.fenceOf("writer")
await lock.release({ grant })

const outbox = recordingOutbox()   // enqueue(manager, message)
outbox.messages     // what the store would hold: the first write of each (queue, eventId)
outbox.writes       // every message written, duplicates included
outbox.entries      // every write with its manager and `inTransaction`
outbox.allInTransaction; outbox.messagesOf("queue"); outbox.clear()

// the claim side: script what a worker's claim returns
outbox.queueRecords(record)                 // the backlog claimDue hands out, in order, filtered by queue and cut at limit
outbox.queueRecords(record, record)         // a duplicate delivery
await outbox.claimDue(params)               // [] when the backlog is empty
outbox.failNext("complete", new Error("db down"))   // the next call of that operation rejects once
outbox.claims; outbox.completed; outbox.retried; outbox.buried; outbox.backlog
```

## `builder`, `fakeIds` and the Outcome matchers

```ts
import { builder, fakeIds } from "@starci/jest-preset"

const options = builder<CommissionOptions>({ bps: 3000, enabled: true })   // a function returning the defaults with overrides applied
const disabled = options({ enabled: false })
const ids = fakeIds()             // ids.next() === "00000000-0000-4000-8000-000000000001", then ...0002; ids.issued, ids.reset()

expect(outcome).toBeRefused("COMMISSION_SELF_REFERRAL")                     // { kind: "refused" } with this code
expect(outcome).toBeRefused({ code: "PLAN_LIMIT", params: { max: 3 } })    // and these params
expect(outcome).toSucceedWith(accrual)                                      // { kind: "ok" } whose value equals `accrual`
```

The matchers are installed in the unit project only (`setupFilesAfterEnv`); their types are declared globally by importing the
package.

## `mock<T>()`

Replaces `{ ... } as unknown as T`.

```ts
import { mock } from "@starci/jest-preset"

const repo = mock<UserRepository>({ name: "users" })       // overrides may be partial
repo.find.mockResolvedValue({ id: "a" })                   // typed against UserRepository["find"]
const service = new UserService(repo)                       // assignable wherever a UserRepository is required
expect(repo.find).toHaveBeenCalledWith("a")
```

Every property read yields one stable `jest.fn()`, created on first read. The double is not thenable, so returning it from
an async function does not hang; `then`, `toJSON` and Symbol keys read as absent. A value you pass in `overrides` wins. Wrong
stubs (`repo.find.mockResolvedValue(1)`) and members the type does not have are compile errors. Fixtures use it instead of
`as never` and `as unknown as`.

## `FakeClock`

The test double for the injected `Clock` port (`platform/clock`). Business code asks `clock.now()` instead of reading
`Date.now()` or `new Date()` ambiently (`no-ambient-clock`, `@starci/eslint-canon-be` R79 `BE_AMBIENT_CLOCK`); a spec
drives time explicitly instead of sleeping for real or racing the wall clock.

```ts
import { FakeClock } from "@starci/jest-preset/clock"

const clock = new FakeClock("2026-01-01T00:00:00.000Z")   // starts at a chosen instant; no argument starts at real now
const service = new PlanService(clock)

clock.advance(60_000)          // move the clock forward (or back, with a negative value) without a real sleep
clock.set("2026-06-15T00:00:00.000Z")   // jump to a chosen instant, e.g. to drive a scheduled job
expect(clock.now().toISOString()).toBe("2026-06-15T00:00:00.000Z")
```

`FakeClock` satisfies the `Clock` port structurally (`{ now(): Date }`); no cast is needed to inject it in place of the
real clock.
