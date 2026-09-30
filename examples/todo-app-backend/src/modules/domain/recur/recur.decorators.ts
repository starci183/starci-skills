import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import { MODULE_OPTIONS_TOKEN } from "./recur.module-definition"
import type { RecurOptions } from "./recur.options"

/** Injects the options of the recur capability. Parameter type: RecurOptions. */
export const InjectRecurOptions = (): TypedParameterDecorator<RecurOptions> => injector<RecurOptions>(MODULE_OPTIONS_TOKEN)
