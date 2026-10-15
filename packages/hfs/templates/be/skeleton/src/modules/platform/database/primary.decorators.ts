import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { EntityManager } from "typeorm"
import type { DatabaseProbeService } from "./database-probe.service"

/** Token of the shared EntityManager of the `primary` database; the database module provides it for the connection it opens. */
export const PRIMARY_ENTITY_MANAGER: unique symbol = Symbol("platform.database.primary-entity-manager")

/** Injects the shared EntityManager of the `primary` database. Parameter type: EntityManager. */
export const InjectPrimaryEntityManager = (): TypedParameterDecorator<EntityManager> =>
    injector<EntityManager>(PRIMARY_ENTITY_MANAGER)

/** The required primary database connectivity probe provided by the database capability. */
export const DATABASE_PROBE: unique symbol = Symbol("platform.database.probe")

/** Injects the primary database connectivity probe. Parameter type: DatabaseProbeService. */
export const InjectDatabaseProbe = (): TypedParameterDecorator<DatabaseProbeService> =>
    injector<DatabaseProbeService>(DATABASE_PROBE)
