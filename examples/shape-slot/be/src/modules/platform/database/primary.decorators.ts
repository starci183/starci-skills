import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { EntityManager } from "typeorm"

/** Token of the shared EntityManager of the `primary` database; the database module provides it for the connection it opens. */
export const PRIMARY_ENTITY_MANAGER: unique symbol = Symbol("platform.database.primary-entity-manager")

/** Injects the shared EntityManager of the `primary` database. Parameter type: EntityManager. */
export const InjectPrimaryEntityManager = (): TypedParameterDecorator<EntityManager> =>
    injector<EntityManager>(PRIMARY_ENTITY_MANAGER)
