import { EnvSource } from "../../../src/modules/platform/config"
import { parsePlatformConfig } from "../../../src/modules/platform/config/platform.config"
import type { PlatformOptions } from "../../../src/modules/platform/config/platform.options"

/** The app's parsed environment (fixture). */
export interface ApiEnv {
    readonly port: number
    readonly platform: PlatformOptions
}

/** The app's typed environment reader (fixture). */
export const readApiEnv = (env: EnvSource): ApiEnv => ({ port: env.int("PORT"), platform: parsePlatformConfig(env) })

/** The environment source is acquired only by main.ts or its app env file (fixture). */
export const envSource = EnvSource.fromProcess()
