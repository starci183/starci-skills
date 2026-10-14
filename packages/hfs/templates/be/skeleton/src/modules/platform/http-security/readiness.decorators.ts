import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { ReadinessService } from "./readiness.service"

/** The required-dependency readiness adapter exposed by the HTTP health module. */
export const READINESS: unique symbol = Symbol("platform.http-security.readiness")

/** Injects the bounded required-dependency probe. Parameter type: ReadinessService. */
export const InjectReadiness = (): TypedParameterDecorator<ReadinessService> => injector<ReadinessService>(READINESS)
