import { CommandBus, QueryBus } from "@nestjs/cqrs"
import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"

/** Injects the command bus. Parameter type: CommandBus. */
export const InjectCommandBus = (): TypedParameterDecorator<CommandBus> => injector<CommandBus>(CommandBus)

/** Injects the query bus. Parameter type: QueryBus. */
export const InjectQueryBus = (): TypedParameterDecorator<QueryBus> => injector<QueryBus>(QueryBus)
