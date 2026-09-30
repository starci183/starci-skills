import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { HealthChecker } from "./health-checker.service"
import { MODULE_OPTIONS_TOKEN } from "./health.module-definition"
import type { HealthOptions } from "./health.options"
import type { HealthProbe } from "./health.port"

/** Token of the HealthChecker. */
export const HEALTH_CHECKER: unique symbol = Symbol("platform.health.checker")

/** Token of the list of HealthProbe instances this app reports on. */
export const HEALTH_PROBES: unique symbol = Symbol("platform.health.probes")

/** Injects the options of the health capability. Parameter type: HealthOptions. */
export const InjectHealthOptions = (): TypedParameterDecorator<HealthOptions> =>
    injector<HealthOptions>(MODULE_OPTIONS_TOKEN)

/** Injects the probes this app reports on. Parameter type: ReadonlyArray of HealthProbe. */
export const InjectHealthProbes = (): TypedParameterDecorator<ReadonlyArray<HealthProbe>> =>
    injector<ReadonlyArray<HealthProbe>>(HEALTH_PROBES)

/** Injects the health checker. Parameter type: HealthChecker. */
export const InjectHealthChecker = (): TypedParameterDecorator<HealthChecker> =>
    injector<HealthChecker>(HEALTH_CHECKER)
