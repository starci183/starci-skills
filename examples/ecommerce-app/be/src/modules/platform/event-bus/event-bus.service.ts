import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectConsumerRegistry, InjectMessagePublisher } from "@modules/platform/messaging"
import type { ConsumerRegistry, MessagePublisher } from "@modules/platform/messaging"
import type { BusEvent } from "./event-bus.contracts"
import type { EventBus, EventConsumer, EventConsumerRegistry } from "./event-bus.port"

@Injectable()
/**
 * The event bus over the queues of `platform/messaging`: the one place that turns an event into a message and a consumer
 * into a queue worker. The transaction is part of the contract (an event is published in the transaction of the change it
 * reports); this transport has no outbox, so it is published when the call is made and the caller calls it after the commit.
 */
export class EventBusService implements EventBus, EventConsumerRegistry {
    constructor(
        @InjectMessagePublisher() private readonly messages: MessagePublisher,
        @InjectConsumerRegistry() private readonly consumers: ConsumerRegistry,
    ) {}

    /** Publishes the event on the queue named after it. */
    async publish<Payload extends object>(event: BusEvent<Payload>, _tx: EntityManager): Promise<void> {
        await this.messages.publish({ queue: event.definition, eventId: event.eventId, payload: event.payload })
    }

    /** Registers the consumer of its event on the queue named after it. */
    add<Payload extends object>(consumer: EventConsumer<Payload>): void {
        this.consumers.add({
            queue: consumer.event,
            handle: (message) =>
                consumer.handle({ eventId: message.eventId, payload: message.payload, attempt: message.attempt }),
        })
    }
}
