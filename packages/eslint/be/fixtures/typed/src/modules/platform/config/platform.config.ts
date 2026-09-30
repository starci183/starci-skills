import { EnvSource } from "./env-source.config"
import type { PlatformOptions } from "./platform.options"

/** Parses the platform options from the environment source (fixture). */
export const parsePlatformConfig = (env: EnvSource): PlatformOptions => ({ isProduction: env.string("NODE_ENV") === "production" })

/** A lazy getter, the shape the rule refuses at every call site (fixture). */
export function platformConfig(): PlatformOptions {
    return parsePlatformConfig(new EnvSource())
}
