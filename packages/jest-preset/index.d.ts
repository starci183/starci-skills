import type { Config } from "jest"

export { mock, createMock, MockOf } from "./mock"

export interface StarciJestOptions {
  rootDir?: string
  tsconfig?: string
  moduleNameMapper?: Record<string, string | string[]>
  roots?: string[]
  unit?: Record<string, unknown>
  e2e?: Record<string, unknown>
}

export declare function starciJestConfig(options?: StarciJestOptions): Config
export declare function collectCoverageFrom(): string[]
export declare function sonarCoverageExclusions(): string
export declare function sonarExclusions(): string
export declare const COVERAGE_SOURCES: string[]
export declare const COVERAGE_EXCLUDES: string[]
