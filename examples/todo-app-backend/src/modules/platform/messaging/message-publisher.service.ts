import { Injectable } from "@nestjs/common"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectOutbox } from "@modules/platform/outbox"
import type { Outbox } from "@modules/platform/outbox"
import type { PublishedMessage } from "./messaging.contracts"
import type { MessagePublisher } from "./messaging.port"

@Injectable()
/** The MessagePublisher adapter: a message is a row of the outbox store the runner of a worker delivers from. */
export class OutboxMessagePublisher implements MessagePublisher {
    constructor(
        @InjectOutbox() private readonly outbox: Outbox,
        @InjectClock() private readonly clock: Clock,
    ) {}

    /** Stores the message, due now unless the message names a later instant. */
    async publish<Payload extends object>(message: PublishedMessage<Payload>): Promise<void> {
        await this.outbox.publish({
            queue: message.queue.name,
            eventId: message.eventId,
            payload: message.payload,
            availableAt: message.availableAt ?? this.clock.now(),
        })
    }
}
