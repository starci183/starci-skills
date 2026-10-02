import type { ConsumedMessage, DeadLetter, PublishedMessage, QueueDefinition, QueueSpec } from "./messaging.contracts"

/** The publishing side of the messaging capability. */
export interface MessagePublisher {
    /** Appends the message to its queue; a message already delivered is published again as a new job. */
    publish<Payload extends object>(message: PublishedMessage<Payload>): Promise<void>
    /** The messages of the queue that ran out of attempts. */
    deadLetters(queue: QueueSpec): Promise<ReadonlyArray<DeadLetter>>
    /** How many messages of the queue wait for the backoff of a failed delivery to pass. */
    pendingRetries(queue: QueueSpec): Promise<number>
    /** Puts a dead letter of the queue back to be delivered again. */
    requeue(queue: QueueSpec, deadLetterId: string): Promise<void>
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
