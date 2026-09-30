import { getEntityManagerToken } from "@nestjs/typeorm"
import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { EntityManager } from "typeorm"
import { IDENTITY_CONNECTION } from "./identity.connection"

/** Injects the shared EntityManager of the `identity` database. Parameter type: EntityManager. */
export const InjectIdentityEntityManager = (): TypedParameterDecorator<EntityManager> =>
    injector<EntityManager>(getEntityManagerToken(IDENTITY_CONNECTION))
