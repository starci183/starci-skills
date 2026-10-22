import type { EnvSource, Secret } from "@modules/platform/config"
import type { IdentityApiOptions } from "./identity-api.options"

/**
 * A secret only a mounted file supplies: `<KEY>_FILE` must be declared (its absence stops the boot naming that key), and a
 * declared file always takes priority over a plaintext `<KEY>`, so the value never comes from an exported variable.
 */
const mountedSecret = (env: EnvSource, key: string): Secret => {
    env.string(`${key}_FILE`)
    return env.secret(key)
}

/**
 * Reads the identity api options: the URL and this service's key are required (the key only from a mounted
 * `IDENTITY_API_SERVICE_KEY_FILE`, never a plaintext value), the timeout is a tunable with a literal default.
 */
export const parseIdentityApiConfig = (env: EnvSource): IdentityApiOptions => ({
    url: env.url("IDENTITY_API_URL"),
    timeoutMs: env.duration("IDENTITY_API_TIMEOUT", 3000),
    serviceKey: mountedSecret(env, "IDENTITY_API_SERVICE_KEY"),
})
