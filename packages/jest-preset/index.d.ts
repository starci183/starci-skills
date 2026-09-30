import type { Config } from "jest"

export { mock, createMock, MockOf } from "./mock"

/** The whole jest config: projects `unit` and `e2e`. It takes no options; the repository config is a managed file. */
export declare function starciJestConfig(): Config
export declare const MODULE_NAME_MAPPER: Readonly<Record<string, string>>
export declare function collectCoverageFrom(): string[]
export declare function sonarCoverageExclusions(): string
export declare function sonarExclusions(): string
export declare const COVERAGE_SOURCES: string[]
export declare const COVERAGE_EXCLUDES: string[]
