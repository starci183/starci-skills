import { getEntityManagerToken } from "@nestjs/typeorm"
import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { EntityManager } from "typeorm"
import { ORDER_CONNECTION } from "./order.connection"

/** Token of the shared EntityManager of the `order` database. */
export const ORDER_ENTITY_MANAGER = getEntityManagerToken(ORDER_CONNECTION)

/** Injects the shared EntityManager of the `order` database. Parameter type: EntityManager. */
export const InjectOrderEntityManager = (): TypedParameterDecorator<EntityManager> =>
    injector<EntityManager>(ORDER_ENTITY_MANAGER)
