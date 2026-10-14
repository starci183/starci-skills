import { EnvSource } from "../../../src/modules/platform/config"
import { parsePlatformConfig } from "../../../src/modules/platform/config/platform.config"

/** The app's typed environment parser (fixture). */
export const parseApiEnv = (env: EnvSource) => ({ port: env.int("PORT"), platform: parsePlatformConfig(env) })

/** The environment source is acquired only by main.ts or its app env file (fixture). */
export const envSource = EnvSource.fromProcess()
