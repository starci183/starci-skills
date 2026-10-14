import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { EntityManager } from "typeorm"
import type { DatabaseReadinessService } from "./database-readiness.service"

/** Token of the shared EntityManager of the `primary` database; the database module provides it for the connection it opens. */
export const PRIMARY_ENTITY_MANAGER: unique symbol = Symbol("platform.database.primary-entity-manager")

/** Injects the shared EntityManager of the `primary` database. Parameter type: EntityManager. */
export const InjectPrimaryEntityManager = (): TypedParameterDecorator<EntityManager> =>
    injector<EntityManager>(PRIMARY_ENTITY_MANAGER)

/** Token of the required primary database readiness probe. */
export const DATABASE_READINESS: unique symbol = Symbol("platform.database.readiness")

/** Injects the owner's readiness service. Parameter type: DatabaseReadinessService. */
export const InjectDatabaseReadiness = (): TypedParameterDecorator<DatabaseReadinessService> =>
    injector<DatabaseReadinessService>(DATABASE_READINESS)
