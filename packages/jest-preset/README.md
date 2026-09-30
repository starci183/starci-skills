# @starci/jest-preset

The jest config of a Nest repository, and the typed `mock<T>()` helper. Install it from the npm registry at the exact version in [`knowledge/hfs/canon-pins.yaml`](../../knowledge/hfs/canon-pins.yaml) (see [`packages/README.md`](../README.md)).

```js
// jest.config.js
const { pathsToModuleNameMapper } = require("ts-jest")
const { starciJestConfig } = require("@starci/jest-preset")
const { compilerOptions } = require("./tsconfig.json")

module.exports = starciJestConfig({
    moduleNameMapper: pathsToModuleNameMapper(compilerOptions.paths, { prefix: `${__dirname}/` }),
    e2e: { globalSetup: "<rootDir>/src/tests/e2e/setup/global-setup.js" },
})
```

## What it sets

- **Two projects**: `unit` (`**/*.spec.ts`, mocked, `clearMocks`) and `e2e` (`src/tests/e2e/**/*.e2e-spec.ts`, one worker, 120 s).
  `src/tests/e2e/live/` is skipped unless `E2E_LIVE=1`; `test:e2e:live` is `E2E_LIVE=1 jest --selectProjects e2e src/tests/e2e/live`.
- **ts-jest with `diagnostics: false`** in both. `isolatedModules: true` comes from `@starci/tsconfig` (ts-jest 29.4 reads it
  there; its own option is deprecated). Types are checked once, by `typecheck` (unit specs included) and `typecheck:e2e`, and
  `test:e2e` is `npm run typecheck:e2e && jest --selectProjects e2e`, so nobody runs e2e on code that does not type-check.
- **Coverage that matches Sonar.** `collectCoverageFrom` is `src/**/*.ts` and `apps/**/*.ts` minus specs, e2e specs, `dist`,
  `coverage`, `src/tests/**`, `*.d.ts` and `main.ts`: the same set Sonar counts. `sonarExclusions()` and
  `sonarCoverageExclusions()` render the two `sonar-project.properties` values from the same lists, so the denominators
  cannot drift. Reports are `coverage/lcov.info` (Codecov and Sonar read the one file) and a text summary. Thresholds are not
  set here; Codecov's project and patch targets own the gate.

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
