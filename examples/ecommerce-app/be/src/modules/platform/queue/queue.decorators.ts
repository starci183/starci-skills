import type { EntityManager } from "typeorm"
import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { QueueOptions } from "./queue.options"
import type { QueueOutbox, QueueWorkerRegistry } from "./queue.port"
import type { QueueFactory, QueueTransport } from "./queue-transport.port"

/** Token of the options of the queues, exported so a spec can provide it. */
export const QUEUE_OPTIONS: unique symbol = Symbol("platform.queue.options")

/** Token of the QueueOutbox port. */
export const QUEUE_OUTBOX: unique symbol = Symbol("platform.queue.outbox")

/** Token of the registry a processor registers its queue handler with. */
export const QUEUE_WORKER_REGISTRY: unique symbol = Symbol("platform.queue.worker-registry")

/** Token of the BullMQ port; it is also the health probe token of the queues. */
export const QUEUE_TRANSPORT: unique symbol = Symbol("platform.queue.transport")

/** Token of the entity managers of the connections whose outbox the relay reads, in the order the options name them. */
export const QUEUE_RELAY_MANAGERS: unique symbol = Symbol("platform.queue.relay-managers")

/** Token of the factory that builds the BullMQ objects, exported so a spec can provide it. */
export const QUEUE_FACTORY: unique symbol = Symbol("platform.queue.factory")

/** Injects the options of the queues. Parameter type: QueueOptions. */
export const InjectQueueOptions = (): TypedParameterDecorator<QueueOptions> => injector<QueueOptions>(QUEUE_OPTIONS)

/** Injects the QueueOutbox port. Parameter type: QueueOutbox. */
export const InjectQueueOutbox = (): TypedParameterDecorator<QueueOutbox> => injector<QueueOutbox>(QUEUE_OUTBOX)

/** Injects the worker registry. Parameter type: QueueWorkerRegistry. */
export const InjectQueueWorkerRegistry = (): TypedParameterDecorator<QueueWorkerRegistry> =>
    injector<QueueWorkerRegistry>(QUEUE_WORKER_REGISTRY)

/** Injects the BullMQ port. Parameter type: QueueTransport. */
export const InjectQueueTransport = (): TypedParameterDecorator<QueueTransport> =>
    injector<QueueTransport>(QUEUE_TRANSPORT)

/** Injects the entity managers the relay reads the outbox of. Parameter type: ReadonlyArray<EntityManager>. */
export const InjectQueueRelayManagers = (): TypedParameterDecorator<ReadonlyArray<EntityManager>> =>
    injector<ReadonlyArray<EntityManager>>(QUEUE_RELAY_MANAGERS)

/** Injects the factory that builds the BullMQ objects. Parameter type: QueueFactory. */
export const InjectQueueFactory = (): TypedParameterDecorator<QueueFactory> => injector<QueueFactory>(QUEUE_FACTORY)
