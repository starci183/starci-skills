import type { EnvSource, Secret } from "@modules/platform/config"
import type { IdentityOptions } from "./identity.options"

/**
 * A secret only a mounted file supplies: `<KEY>_FILE` must be declared (its absence stops the boot naming that key), and a
 * declared file always takes priority over a plaintext `<KEY>`, so the value never comes from an exported variable.
 */
const mountedSecret = (env: EnvSource, key: string): Secret => {
    env.string(`${key}_FILE`)
    return env.secret(key)
}

/**
 * Reads the keys the identity app accepts on its service doors, one per calling service. Each is read only from a mounted
 * `<KEY>_FILE` (the decrypted form of sealed custody in a deployment, a per-run file of the dev browser stack): a plaintext
 * value alone stops the boot, and a mounted file always wins over one.
 */
export const parseIdentityConfig = (env: EnvSource): Pick<IdentityOptions, "serviceKeys"> => ({
    serviceKeys: {
        order: mountedSecret(env, "ORDER_SERVICE_KEY"),
        billing: mountedSecret(env, "BILLING_SERVICE_KEY"),
    },
})
