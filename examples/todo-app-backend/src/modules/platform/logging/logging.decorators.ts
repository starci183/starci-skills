import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { Logger } from "./logging.port"

/** Token of the Logger port. */
export const LOGGER: unique symbol = Symbol("platform.logging.logger")

/** Injects the Logger port. Parameter type: Logger. */
export const InjectLogger = (): TypedParameterDecorator<Logger> => injector<Logger>(LOGGER)
