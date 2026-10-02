import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectConsumerRegistry, InjectMessagePublisher } from "@modules/platform/messaging"
import type { ConsumerRegistry, MessagePublisher, QueueSpec } from "@modules/platform/messaging"
import { isRecord } from "@modules/platform/primitives"
import { EventBusError, EventBusErrorCode } from "./errors/event-bus.error"
import type { BaseEvent, EventClass, EventDeadLetter } from "./event-bus.contracts"
import type { EventBus, EventConsumer, EventConsumerRegistry } from "./event-bus.port"

/** How many deliveries an event gets before it is a dead letter. */
const ATTEMPTS = 3

/** The pause after the first failed delivery; it doubles with every further failure. */
const BACKOFF_MS = 1000

/** What joins the event name and the job id in the id of a dead letter. */
const ID_SEPARATOR = "|"

/** The queue an event class travels on: named after the event. */
const queueOf = (event: EventClass<BaseEvent>): QueueSpec => ({
    name: event.eventName,
    attempts: ATTEMPTS,
    backoffMs: BACKOFF_MS,
})

@Injectable()
/**
 * The event bus over the queues of `platform/messaging`: the one place that turns an event into a message and a consumer into a
 * queue worker. The transaction is part of the contract (an event is published in the transaction of the change it reports);
 * this transport has no outbox, so the event is published when the call is made and the caller calls it after the commit.
 */
export class EventBusService implements EventBus, EventConsumerRegistry {
    constructor(
        @InjectMessagePublisher() private readonly messages: MessagePublisher,
        @InjectConsumerRegistry() private readonly consumers: ConsumerRegistry,
    ) {}

    /** Publishes the event on the queue named after it, with its event id as the dedupe key. */
    async publish(event: BaseEvent, _tx: EntityManager): Promise<void> {
        await this.messages.publish({
            queue: { name: event.eventName, attempts: ATTEMPTS, backoffMs: BACKOFF_MS },
            eventId: event.eventId,
            payload: event.payload,
        })
    }

    /** How many events of the class wait for a retry. */
    pendingRetries(event: EventClass<BaseEvent>): Promise<number> {
        return this.messages.pendingRetries(queueOf(event))
    }

    /** The events of the class that ran out of attempts. */
    async deadLetters(event: EventClass<BaseEvent>): Promise<ReadonlyArray<EventDeadLetter>> {
        const letters = await this.messages.deadLetters(queueOf(event))
        return letters.map((letter) => ({
            ...letter,
            id: `${event.eventName}${ID_SEPARATOR}${letter.id}`,
            eventName: event.eventName,
        }))
    }

    /** Puts a dead letter back to be delivered again: its id names the event and the job. */
    requeue(deadLetterId: string): Promise<void> {
        const at = deadLetterId.lastIndexOf(ID_SEPARATOR)
        return this.messages.requeue(
            { name: deadLetterId.slice(0, at), attempts: ATTEMPTS, backoffMs: BACKOFF_MS },
            deadLetterId.slice(at + ID_SEPARATOR.length),
        )
    }

    /** Registers the consumer of its event class on the queue named after it; the envelope is read back into the event before the handler runs. */
    add<Event extends BaseEvent>(consumer: EventConsumer<Event>): void {
        this.consumers.add({
            queue: { ...queueOf(consumer.event), parse: (value) => (isRecord(value) ? value : null) },
            handle: async (message) => {
                const event = consumer.event.parse({ eventId: message.eventId, payload: message.payload })
                if (event === null) {
                    throw new EventBusError({
                        code: EventBusErrorCode.EnvelopeInvalid,
                        params: { event: consumer.event.eventName },
                    })
                }
                await consumer.handle({ eventId: message.eventId, event, attempt: message.attempt })
            },
        })
    }
}
