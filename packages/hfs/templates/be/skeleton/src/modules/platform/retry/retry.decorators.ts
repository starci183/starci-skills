import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { Timer } from "./retry.port"

/** The cancellable host timer provided by the retry capability. */
export const TIMER: unique symbol = Symbol("platform.retry.timer")

/** Injects the cancellable timer. Parameter type: Timer. */
export const InjectTimer = (): TypedParameterDecorator<Timer> => injector<Timer>(TIMER)
