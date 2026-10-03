import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { DatabaseOptions } from "./database.options"

/** Token of the options of the database capability. */
export const DATABASE_OPTIONS: unique symbol = Symbol("platform.database.options")

/** Injects the options of the database capability. Parameter type: DatabaseOptions. */
export const InjectDatabaseOptions = (): TypedParameterDecorator<DatabaseOptions> =>
    injector<DatabaseOptions>(DATABASE_OPTIONS)
