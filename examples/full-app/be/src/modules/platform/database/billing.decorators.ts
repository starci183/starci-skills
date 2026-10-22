import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { EntityManager } from "typeorm"

/** Token of the shared EntityManager of the `billing` database; the database module provides it for the connection it opens. */
export const BILLING_ENTITY_MANAGER: unique symbol = Symbol("platform.database.billing-entity-manager")

/** Injects the shared EntityManager of the `billing` database. Parameter type: EntityManager. */
export const InjectBillingEntityManager = (): TypedParameterDecorator<EntityManager> =>
    injector<EntityManager>(BILLING_ENTITY_MANAGER)
