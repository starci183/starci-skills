import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import { getEntityManagerToken } from "@nestjs/typeorm"
import type { EntityManager } from "typeorm"
import { PRIMARY_CONNECTION } from "./primary.connection"

/** Token of the shared EntityManager of the `primary` database; DatabaseModule aliases it to the connection provider. */
export const PRIMARY_ENTITY_MANAGER: unique symbol = Symbol("platform.database.primary-entity-manager")

/** Injects the shared EntityManager of the `primary` database. Parameter type: EntityManager. */
export const InjectPrimaryEntityManager = (): TypedParameterDecorator<EntityManager> =>
    injector<EntityManager>(PRIMARY_ENTITY_MANAGER)

/** The provider that aliases the token to the EntityManager of the `primary` connection; DatabaseModule registers it. */
export const PRIMARY_ENTITY_MANAGER_PROVIDER = {
    provide: PRIMARY_ENTITY_MANAGER,
    useExisting: getEntityManagerToken(PRIMARY_CONNECTION),
}
