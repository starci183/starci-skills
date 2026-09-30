import { getEntityManagerToken } from "@nestjs/typeorm"
import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { EntityManager } from "typeorm"
import { IDENTITY_CONNECTION } from "./identity.connection"

/** Token of the shared EntityManager of the `identity` database. */
export const IDENTITY_ENTITY_MANAGER = getEntityManagerToken(IDENTITY_CONNECTION)

/** Injects the shared EntityManager of the `identity` database. Parameter type: EntityManager. */
export const InjectIdentityEntityManager = (): TypedParameterDecorator<EntityManager> =>
    injector<EntityManager>(IDENTITY_ENTITY_MANAGER)
