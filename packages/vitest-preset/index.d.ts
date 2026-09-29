import type { UserConfig } from "vitest/config"

export interface StarciVitestProjectOptions {
    name: string
    root: string
    alias?: Record<string, string>
    setupFiles?: string[]
    plugins?: unknown[]
    inline?: (string | RegExp)[]
}

export interface StarciVitestWorkspaceOptions {
    rootDir: string
    projects?: string[]
    plugins?: unknown[]
}

export declare const COVERAGE_INCLUDE: string[]
export declare const COVERAGE_EXCLUDE: string[]
export declare const SONAR_EXCLUSIONS: string[]
export declare const COVERAGE_ONLY_EXCLUSIONS: string[]
export declare const DEDUPE: string[]
export declare const INLINE_DEPS: (string | RegExp)[]
export declare function sonarExclusions(): string
export declare function sonarCoverageExclusions(): string
export declare function starciVitestProject(options: StarciVitestProjectOptions): UserConfig
export declare function starciVitestWorkspace(options: StarciVitestWorkspaceOptions): UserConfig
