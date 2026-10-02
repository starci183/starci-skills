import { Injectable } from "@nestjs/common"
import type { CommandBus } from "@nestjs/cqrs"
import { @@Failed@@Event } from "@modules/events/@@from@@"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { EventConsumer, EventDelivery } from "@modules/platform/event-bus"
import { Compensate@@Saga@@Command } from "../../application/compensate-@@saga@@.command"

@Injectable()
/** Consumer of `@@from@@.@@failed@@`, the failure event of the @@saga@@ saga: hands each delivery to the compensate command. */
export class @@Failed@@Consumer implements EventConsumer<@@Failed@@Event> {
    readonly event = @@Failed@@Event

    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Dispatches one compensate command; the saga takes the delivery through the inbox, so a redelivery is a no-op. */
    async handle(delivery: EventDelivery<@@Failed@@Event>): Promise<void> {
        await this.commandBus.execute(
            new Compensate@@Saga@@Command({ request: { id: delivery.event.payload.id, eventId: delivery.eventId } }),
        )
    }
}
