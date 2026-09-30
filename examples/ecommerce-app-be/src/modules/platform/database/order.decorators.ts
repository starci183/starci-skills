import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { EntityManager } from "typeorm"

/** Token of the shared EntityManager of the `order` database; the database module provides it for the connection it opens. */
export const ORDER_ENTITY_MANAGER: unique symbol = Symbol("platform.database.order-entity-manager")

/** Injects the shared EntityManager of the `order` database. Parameter type: EntityManager. */
export const InjectOrderEntityManager = (): TypedParameterDecorator<EntityManager> =>
    injector<EntityManager>(ORDER_ENTITY_MANAGER)
