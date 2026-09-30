import type { Config } from "jest"

export { mock, createMock, MockOf } from "./mock"
export { mockEntityManager, fakeTransaction, MockEntityManager, FakeTransaction, EntityClass } from "./entity-manager"
export { fakeCache, FakeCache } from "./cache"
export { fakeLock, FakeLock } from "./lock"
export { recordingOutbox, RecordingOutbox } from "./outbox"
export { builder } from "./builders"
export { FakeClock } from "./clock"
export { fakeIds, FakeIds } from "./ids"
export { RefusalReason } from "./matchers"

/** The whole jest config: projects `unit`, `integration`, `e2e` and `contract`. It takes no options; the repository config is a managed file. */
export declare function starciJestConfig(): Config
export declare const MODULE_NAME_MAPPER: Readonly<Record<string, string>>
export declare function collectCoverageFrom(): string[]
export declare function sonarExclusions(): string
export declare const COVERAGE_SOURCES: string[]
export declare const COVERAGE_EXCLUDES: string[]
export declare const COVERAGE_THRESHOLD: Readonly<{ lines: 100; branches: 100; functions: 100; statements: 100 }>
