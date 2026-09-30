import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { RecurOptions } from "./recur.options"

/** The token the options of the recur capability are provided under. */
export const RECUR_OPTIONS: unique symbol = Symbol("domain.recur.options")

/** Injects the options of the recur capability. Parameter type: RecurOptions. */
export const InjectRecurOptions = (): TypedParameterDecorator<RecurOptions> => injector<RecurOptions>(RECUR_OPTIONS)
