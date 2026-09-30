import { getEntityManagerToken } from "@nestjs/typeorm"
import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { EntityManager } from "typeorm"
import { PRIMARY_CONNECTION } from "./primary.connection"

/** Token of the shared EntityManager of the `primary` database. */
export const PRIMARY_ENTITY_MANAGER = getEntityManagerToken(PRIMARY_CONNECTION)

/** Injects the shared EntityManager of the `primary` database. Parameter type: EntityManager. */
export const InjectPrimaryEntityManager = (): TypedParameterDecorator<EntityManager> =>
    injector<EntityManager>(PRIMARY_ENTITY_MANAGER)
