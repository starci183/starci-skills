import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { ServerOptions } from "./server.options"

/** Token under which the app module provides its {@link ServerOptions}. */
export const SERVER_OPTIONS: unique symbol = Symbol("platform.config.server-options")

/** Injects the server options of the app. Parameter type: ServerOptions. */
export const InjectServerOptions = (): TypedParameterDecorator<ServerOptions> => injector<ServerOptions>(SERVER_OPTIONS)
