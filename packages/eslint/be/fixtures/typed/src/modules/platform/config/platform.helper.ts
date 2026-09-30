import type { PlatformOptions } from "./platform.options"

/** A helper outside a config file that returns options (fixture). */
export const buildPlatformOptions = (): PlatformOptions => ({ isProduction: true })
