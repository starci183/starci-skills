import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { Ids } from "./ids.port"

/** Token of the Ids port. */
export const IDS: unique symbol = Symbol("platform.ids")

/** Injects the Ids port. Parameter type: Ids. */
export const InjectIds = (): TypedParameterDecorator<Ids> => injector<Ids>(IDS)
