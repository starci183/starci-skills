import type { Config } from "jest"

export { mock, createMock, MockOf } from "./mock"
export { mockEntityManager, fakeTransaction, MockEntityManager, FakeTransaction, EntityClass } from "./entity-manager"
export { fakeCache, FakeCache } from "./cache"
export { fakeLock, FakeLock } from "./lock"
export { recordingEventBus, RecordingEventBus } from "./event-bus"
export { recordingQueueOutbox, RecordingQueueOutbox } from "./queue"
export { fakeInbox, FakeInbox } from "./inbox"
export { builder } from "./builders"
export { FakeClock } from "./clock"
export { fakeIds, FakeIds } from "./ids"
export { RefusalReason } from "./matchers"

/** The coverage scope `hfs sync` renders from the slot manifest: the measured roots (a directory pattern per measured slot, a placeholder folder written as a star), the logic roles measured in them and the directories inside a root that are never measured (each ending in a double star). */
export interface StarciCoverageScope {
  readonly roots: readonly string[]
  readonly roles: readonly string[]
  readonly excludes: readonly string[]
}
export interface StarciJestOptions {
  readonly coverage: StarciCoverageScope
}
/** The whole jest config: projects `unit`, `integration`, `e2e` and `contract`. It takes the coverage scope the managed repository config renders; without it it refuses. */
export declare function starciJestConfig(options: StarciJestOptions): Config
export declare const MODULE_NAME_MAPPER: Readonly<Record<string, string>>
export declare function collectCoverageFrom(coverage: StarciCoverageScope): string[]
/** The glob one measured root stands for: every file of a logic role below it. */
export declare function rootGlob(root: string, roles: readonly string[]): string
/** True when `root` holds a file the coverage `glob` matches (a threshold key that matches nothing is refused by jest). */
export declare function hasCoverageSubjects(root: string, glob: string): boolean
export declare function sonarExclusions(): string
export declare const COVERAGE_EXCLUDES: string[]
/** The compiler options the unit project overlays on the repository tsconfig so per-file 100 coverage of a decorated service is reachable. */
export declare const UNIT_COMPILER_OPTIONS: Readonly<{ isolatedModules: false; importHelpers: true }>
/** The runner of the integration, e2e and contract projects (`world-runner.cjs`): every spec file in a worker process of its own. */
export declare const WORLD_RUNNER: string
export declare const COVERAGE_THRESHOLD: Readonly<{ lines: 100; branches: 100; functions: 100; statements: 100 }>
