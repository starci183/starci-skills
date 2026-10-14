import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { EventBus } from "./event-bus.port"

/** Token of the transactional EventBus publisher. */
export const EVENT_BUS: unique symbol = Symbol("platform.event-bus")

/** Injects the EventBus port. Parameter type: EventBus. */
export const InjectEventBus = (): TypedParameterDecorator<EventBus> => injector<EventBus>(EVENT_BUS)
