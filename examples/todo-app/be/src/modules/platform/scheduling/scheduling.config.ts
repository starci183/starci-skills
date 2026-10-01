import type { EnvSource } from "@modules/platform/config"
import type { SchedulingOptions } from "./scheduling.options"

/** Reads the scheduling options; the tick is a tunable with a literal default. */
export const parseSchedulingConfig = (env: EnvSource): SchedulingOptions => ({
    tickMs: env.duration("SCHEDULING_TICK", 1_000),
})
