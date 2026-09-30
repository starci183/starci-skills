import type { EnvSource } from "@modules/platform/config"
import type { HttpSecurityOptions } from "./http-security.options"

/** Reads the http-security options: the origin allowlist is required, the rate limits are tunables with literal defaults. */
export const parseHttpSecurityConfig = (env: EnvSource): HttpSecurityOptions => ({
    allowedOrigins: env
        .string("HTTP_SECURITY_ALLOWED_ORIGINS")
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean),
    rateLimit: {
        windowMs: env.duration("HTTP_SECURITY_RATE_WINDOW", 60_000),
        defaultLimit: env.int("HTTP_SECURITY_RATE_DEFAULT_LIMIT", 600),
        strictLimit: env.int("HTTP_SECURITY_RATE_STRICT_LIMIT", 30),
    },
})
