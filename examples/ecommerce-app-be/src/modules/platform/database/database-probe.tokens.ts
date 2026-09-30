import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { EntityManager } from "typeorm"

/** Token of the managers of every connection the app opened. */
export const DATABASE_MANAGERS: unique symbol = Symbol("platform.database.managers")

/** Injects the managers of every connection the app opened. Parameter type: ReadonlyArray of EntityManager. */
export const InjectDatabaseManagers = (): TypedParameterDecorator<ReadonlyArray<EntityManager>> =>
    injector<ReadonlyArray<EntityManager>>(DATABASE_MANAGERS)
