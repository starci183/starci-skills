/** Fixture stand-in for the one injector of the `primary` connection. */
import { getEntityManagerToken } from "@nestjs/typeorm"
import type { EntityManager } from "typeorm"
import { injector, type TypedParameterDecorator } from "@modules/platform/composition/injector"

/** Injects the `primary` connection's EntityManager. */
export const InjectPrimaryEntityManager = (): TypedParameterDecorator<EntityManager> => injector(getEntityManagerToken("primary"))
