import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import { ReadinessService } from "./readiness.service"

/** Injects the bounded required-dependency probe. Parameter type: ReadinessService. */
export const InjectReadiness = (): TypedParameterDecorator<ReadinessService> =>
    injector<ReadinessService>(ReadinessService)
