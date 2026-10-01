import type { EnvSource } from "./env-source.config"
import type { ServerOptions } from "./server.options"

/** Parses the server keys of an environment; a missing or malformed PORT stops the boot. */
export const parseServerConfig = (env: EnvSource): ServerOptions => ({ port: env.int("PORT") })
