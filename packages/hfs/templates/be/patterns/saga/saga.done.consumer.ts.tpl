import { Injectable } from "@nestjs/common"
import type { CommandBus } from "@nestjs/cqrs"
import { @@Done@@Event } from "@modules/events/@@from@@"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { EventConsumer, EventDelivery } from "@modules/platform/event-bus"
import { Complete@@Saga@@Command } from "../../application/complete-@@saga@@.command"

@Injectable()
/** Consumer of `@@from@@.@@done@@`, the last event of the @@saga@@ saga: hands each delivery to the complete command. */
export class @@Done@@Consumer implements EventConsumer<@@Done@@Event> {
    readonly event = @@Done@@Event

    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Dispatches one complete command; the saga takes the delivery through the inbox, so a redelivery is a no-op. */
    async handle(delivery: EventDelivery<@@Done@@Event>): Promise<void> {
        await this.commandBus.execute(
            new Complete@@Saga@@Command({ request: { id: delivery.event.payload.id, eventId: delivery.eventId } }),
        )
    }
}
