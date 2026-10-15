import { getDataSourceToken } from "@nestjs/typeorm"
import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { DatabaseOptions } from "./database.options"
import { PRIMARY_CONNECTION } from "./primary.connection"

/** The primary pool's override token for infrastructure fixtures; TypeORM tokens stay owned by this capability. */
export const PRIMARY_DATA_SOURCE = getDataSourceToken(PRIMARY_CONNECTION)

/** Token of the options of the database capability. */
export const DATABASE_OPTIONS: unique symbol = Symbol("platform.database.options")

/** Injects the options of the database capability. Parameter type: DatabaseOptions. */
export const InjectDatabaseOptions = (): TypedParameterDecorator<DatabaseOptions> =>
    injector<DatabaseOptions>(DATABASE_OPTIONS)
