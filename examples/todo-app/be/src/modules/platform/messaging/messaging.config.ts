import type { EnvSource } from "@modules/platform/config"
import type { MessagingOptions } from "./messaging.options"

/** Reads the messaging options; every key is a tunable with a literal default. */
export const parseMessagingConfig = (env: EnvSource): MessagingOptions => ({
    pollMs: env.duration("MESSAGING_POLL", 1_000),
    batchSize: env.int("MESSAGING_BATCH", 20),
    visibilityMs: env.duration("MESSAGING_VISIBILITY", 300_000),
})
