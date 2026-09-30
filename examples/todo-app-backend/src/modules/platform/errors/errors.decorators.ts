import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import { MODULE_OPTIONS_TOKEN } from "./errors.module-definition"
import type { ErrorsOptions } from "./errors.options"
import type { ErrorsService } from "./errors.service"

/** Token of the errors options, exported so a spec can provide it. */
export const ERRORS_OPTIONS = MODULE_OPTIONS_TOKEN

/** Token of the service that describes failures for the transports. */
export const ERRORS_SERVICE: unique symbol = Symbol("platform.errors.service")

/** Injects the options of the errors capability. Parameter type: ErrorsOptions. */
export const InjectErrorsOptions = (): TypedParameterDecorator<ErrorsOptions> =>
    injector<ErrorsOptions>(ERRORS_OPTIONS)

/** Injects the service that describes failures for the transports. Parameter type: ErrorsService. */
export const InjectErrorsService = (): TypedParameterDecorator<ErrorsService> =>
    injector<ErrorsService>(ERRORS_SERVICE)
