import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { MetricsRegistryService } from "./metrics-registry.service"

/** Token of the Metrics port. */
export const METRICS: unique symbol = Symbol("platform.observability.metrics")

/** Injects the metrics registry. Parameter type: MetricsRegistryService. */
export const InjectMetrics = (): TypedParameterDecorator<MetricsRegistryService> =>
    injector<MetricsRegistryService>(METRICS)
