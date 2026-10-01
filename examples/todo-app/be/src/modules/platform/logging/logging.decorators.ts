import type { Writable } from "node:stream"
import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { Logger } from "./logging.port"

/** Token of the Logger port. */
export const LOGGER: unique symbol = Symbol("platform.logging.logger")

/** Injects the Logger port. Parameter type: Logger. */
export const InjectLogger = (): TypedParameterDecorator<Logger> => injector<Logger>(LOGGER)

/** Token of the stream info lines go to. */
export const LOG_OUT: unique symbol = Symbol("platform.logging.out")

/** Token of the stream warn and error lines go to. */
export const LOG_ERR: unique symbol = Symbol("platform.logging.err")

/** Injects the stream info lines go to. Parameter type: Writable. */
export const InjectLogOut = (): TypedParameterDecorator<Writable> => injector<Writable>(LOG_OUT)

/** Injects the stream warn and error lines go to. Parameter type: Writable. */
export const InjectLogErr = (): TypedParameterDecorator<Writable> => injector<Writable>(LOG_ERR)
