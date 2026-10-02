import type { EntityManager } from "typeorm"
import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { EventBusOptions } from "./event-bus.options"
import type { EventBus, EventConsumerRegistry } from "./event-bus.port"
import type { EventTransport } from "./event-transport.port"

/** Token of the options of the event bus, exported so a spec can provide it. */
export const EVENT_BUS_OPTIONS: unique symbol = Symbol("platform.event-bus.options")

/** Token of the EventBus port. */
export const EVENT_BUS: unique symbol = Symbol("platform.event-bus")

/** Token of the consumer registry of the bus. */
export const EVENT_CONSUMER_REGISTRY: unique symbol = Symbol("platform.event-bus.registry")

/** Token of the broker port; it is also the health probe token of the bus. */
export const EVENT_TRANSPORT: unique symbol = Symbol("platform.event-bus.transport")

/** Token of the shared entity manager of the connection that holds the outbox the relay reads. */
export const EVENT_BUS_MANAGER: unique symbol = Symbol("platform.event-bus.manager")

/** Injects the options of the event bus. Parameter type: EventBusOptions. */
export const InjectEventBusOptions = (): TypedParameterDecorator<EventBusOptions> =>
    injector<EventBusOptions>(EVENT_BUS_OPTIONS)

/** Injects the EventBus port. Parameter type: EventBus. */
export const InjectEventBus = (): TypedParameterDecorator<EventBus> => injector<EventBus>(EVENT_BUS)

/** Injects the consumer registry a message transport registers its consumers with. Parameter type: EventConsumerRegistry. */
export const InjectEventConsumerRegistry = (): TypedParameterDecorator<EventConsumerRegistry> =>
    injector<EventConsumerRegistry>(EVENT_CONSUMER_REGISTRY)

/** Injects the broker port. Parameter type: EventTransport. */
export const InjectEventTransport = (): TypedParameterDecorator<EventTransport> =>
    injector<EventTransport>(EVENT_TRANSPORT)

/** Injects the entity manager of the connection whose outbox the relay reads. Parameter type: EntityManager. */
export const InjectEventBusManager = (): TypedParameterDecorator<EntityManager> =>
    injector<EntityManager>(EVENT_BUS_MANAGER)
