import type { EnvSource } from "@modules/platform/config"
import type { IdentityApiOptions } from "./identity-api.options"

/** Reads the identity api options: the URL is required, the timeout is a tunable with a literal default. */
export const parseIdentityApiConfig = (env: EnvSource): IdentityApiOptions => ({
    url: env.url("IDENTITY_API_URL"),
    timeoutMs: env.duration("IDENTITY_API_TIMEOUT", 3000),
})
