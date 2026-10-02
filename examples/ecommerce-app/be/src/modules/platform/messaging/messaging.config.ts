import type { EnvSource } from "@modules/platform/config"
import type { MessagingOptions } from "./messaging.options"

/** Reads the messaging options: the Redis URL is required, the rest are tunables with literal defaults. */
export const parseMessagingConfig = (env: EnvSource): MessagingOptions => ({
    url: env.secret("MESSAGING_REDIS_URL"),
    timeoutMs: env.duration("MESSAGING_TIMEOUT", 3000),
    concurrency: env.int("MESSAGING_CONCURRENCY", 1),
})
