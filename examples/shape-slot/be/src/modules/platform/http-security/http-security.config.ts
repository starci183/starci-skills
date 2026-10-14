import type { EnvSource } from "@modules/platform/config"
import type { HttpSecurityOptions } from "./http-security.options"
import { allowedOriginsOf, trustProxyOf } from "./http-security.policy"

/** Reads required exact origins and optional proxy/rate tunables; the policy rejects unsafe values. */
export const parseHttpSecurityConfig = (env: EnvSource): HttpSecurityOptions => ({
    allowedOrigins: allowedOriginsOf(env.string("HTTP_SECURITY_ALLOWED_ORIGINS")),
    trustProxy: trustProxyOf(env.int("HTTP_SECURITY_TRUST_PROXY", 0)),
    rateLimit: {
        windowMs: env.duration("HTTP_SECURITY_RATE_WINDOW", 60_000),
        defaultLimit: env.int("HTTP_SECURITY_RATE_DEFAULT_LIMIT", 600),
        strictLimit: env.int("HTTP_SECURITY_RATE_STRICT_LIMIT", 30),
    },
})
