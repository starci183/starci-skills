import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { DatabaseOptions } from "./database.options"

/** Token of the database capability's supplied connection options. */
export const DATABASE_OPTIONS: unique symbol = Symbol("platform.database.options")

/** Injects the typed connection options registered by the app or test world. */
export const InjectDatabaseOptions = (): TypedParameterDecorator<DatabaseOptions> =>
    injector<DatabaseOptions>(DATABASE_OPTIONS)
