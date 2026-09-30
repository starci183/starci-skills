import type { ConsumedMessage, PublishedMessage, QueueDefinition } from "./messaging.contracts"

/** Publishes messages that no transaction is behind; a message that must commit with a write goes through the outbox instead. */
export interface MessagePublisher {
    /** Stores the message for delivery. */
    publish<Payload extends object>(message: PublishedMessage<Payload>): Promise<void>
}

/** One consumer of one queue; a transport class in `transport/message` implements it. */
export interface MessageConsumer<Payload extends object> {
    /** The queue this consumer reads. */
    readonly queue: QueueDefinition<Payload>
    /** Handles one delivery; a throw schedules a retry, a return completes the message. */
    handle(message: ConsumedMessage<Payload>): Promise<void>
}

/** Where a message transport module registers its consumers. */
export interface ConsumerRegistry {
    /** Registers the consumer of its queue. */
    add<Payload extends object>(consumer: MessageConsumer<Payload>): void
}
