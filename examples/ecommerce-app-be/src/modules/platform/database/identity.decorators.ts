import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { EntityManager } from "typeorm"

/** Token of the shared EntityManager of the `identity` database; the database module provides it for the connection it opens. */
export const IDENTITY_ENTITY_MANAGER: unique symbol = Symbol("platform.database.identity-entity-manager")

/** Injects the shared EntityManager of the `identity` database. Parameter type: EntityManager. */
export const InjectIdentityEntityManager = (): TypedParameterDecorator<EntityManager> =>
    injector<EntityManager>(IDENTITY_ENTITY_MANAGER)
