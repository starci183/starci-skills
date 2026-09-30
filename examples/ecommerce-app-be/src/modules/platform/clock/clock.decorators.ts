import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { Clock } from "./clock.port"

/** Token of the Clock port. */
export const CLOCK: unique symbol = Symbol("platform.clock")

/** Injects the Clock port. Parameter type: Clock. */
export const InjectClock = (): TypedParameterDecorator<Clock> => injector<Clock>(CLOCK)
