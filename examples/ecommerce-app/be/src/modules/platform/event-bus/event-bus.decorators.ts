import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { EventBus, EventConsumerRegistry } from "./event-bus.port"

/** Token of the EventBus port. */
export const EVENT_BUS: unique symbol = Symbol("platform.event-bus")

/** Token of the consumer registry of the bus. */
export const EVENT_CONSUMER_REGISTRY: unique symbol = Symbol("platform.event-bus.registry")

/** Injects the EventBus port. Parameter type: EventBus. */
export const InjectEventBus = (): TypedParameterDecorator<EventBus> => injector<EventBus>(EVENT_BUS)

/** Injects the consumer registry a message transport registers its consumers with. Parameter type: EventConsumerRegistry. */
export const InjectEventConsumerRegistry = (): TypedParameterDecorator<EventConsumerRegistry> =>
    injector<EventConsumerRegistry>(EVENT_CONSUMER_REGISTRY)
