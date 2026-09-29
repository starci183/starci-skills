import type { EnvSource } from "./env-source"
import { ConfigError } from "./errors/config.error"
import type { ServerOptions } from "./server.options"

const DEFAULT_PORT = 3000
const MAX_PORT = 65535

/** Parses the server keys of an environment; a malformed PORT stops the boot. */
export const parseServerConfig = (env: EnvSource): ServerOptions => {
    const raw = env.optional("PORT")
    if (raw === undefined) return { port: DEFAULT_PORT }
    const port = Number(raw)
    if (!Number.isInteger(port) || port < 1 || port > MAX_PORT) throw new ConfigError("CONFIG_KEY_INVALID", "PORT")
    return { port }
}
