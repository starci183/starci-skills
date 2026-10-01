import type { AnyTestWorldConfig } from "./types"

const KEY = Symbol.for("@starci/test-world/declaration")

/** Remembers the declaration `defineTestWorld` was called with, so the globalSetup entry can read it after loading `test-world.config.ts`. */
export const rememberDeclaration = (config: AnyTestWorldConfig): void => {
    ;(globalThis as Record<symbol, unknown>)[KEY] = config
}

/** The declaration remembered by the last `defineTestWorld`, or null when the config file has not been loaded. */
export const rememberedDeclaration = (): AnyTestWorldConfig | null => ((globalThis as Record<symbol, unknown>)[KEY] as AnyTestWorldConfig | undefined) ?? null
