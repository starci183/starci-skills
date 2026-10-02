import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import { MODULE_OPTIONS_TOKEN } from "./migrate.module-definition"
import type { MigrateOptions, OpenConnection } from "./migrate.options"

/** Token of the function that opens the data source of one connection. */
export const OPEN_CONNECTION: unique symbol = Symbol("features.cli.migrate.open-connection")

/** Injects the options of the migrate group. Parameter type: MigrateOptions. */
export const InjectMigrateOptions = (): TypedParameterDecorator<MigrateOptions> =>
    injector<MigrateOptions>(MODULE_OPTIONS_TOKEN)

/** Injects the function that opens the data source of one connection. Parameter type: OpenConnection. */
export const InjectOpenConnection = (): TypedParameterDecorator<OpenConnection> =>
    injector<OpenConnection>(OPEN_CONNECTION)
