import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { SchedulingOptions } from "./scheduling.options"
import type { JobRegistry } from "./scheduling.port"

/** Token of the scheduling options, exported so a spec can provide it. */
export const SCHEDULING_OPTIONS: unique symbol = Symbol("platform.scheduling.options")

/** Token of the job registry. */
export const JOB_REGISTRY: unique symbol = Symbol("platform.scheduling.job-registry")

/** Injects the options of the scheduling capability. Parameter type: SchedulingOptions. */
export const InjectSchedulingOptions = (): TypedParameterDecorator<SchedulingOptions> =>
    injector<SchedulingOptions>(SCHEDULING_OPTIONS)

/** Injects the job registry. Parameter type: JobRegistry. */
export const InjectJobRegistry = (): TypedParameterDecorator<JobRegistry> => injector<JobRegistry>(JOB_REGISTRY)
