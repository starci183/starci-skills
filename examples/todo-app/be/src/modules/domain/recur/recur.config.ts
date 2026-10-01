import type { EnvSource } from "@modules/platform/config"
import type { RecurOptions } from "./recur.options"

/** Reads the recur options: the generation tick is a tunable with a literal default of every five minutes. */
export const parseRecurConfig = (env: EnvSource): RecurOptions => ({
    tickCron: env.optional("RECUR_TICK_CRON") ?? "*/5 * * * *",
})
