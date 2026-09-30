import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { Metrics } from "./observability.port"

/** Token of the Metrics port. */
export const METRICS: unique symbol = Symbol("platform.observability.metrics")

/** Injects the Metrics port. Parameter type: Metrics. */
export const InjectMetrics = (): TypedParameterDecorator<Metrics> => injector<Metrics>(METRICS)
