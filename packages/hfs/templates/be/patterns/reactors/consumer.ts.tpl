import { Injectable } from "@nestjs/common"
import type { CommandBus } from "@nestjs/cqrs"
import { @@Event@@Event } from "@modules/events/@@from@@"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { EventConsumer, EventDelivery } from "@modules/platform/event-bus"
import { @@Action@@Command } from "../../application/@@action@@.command"

@Injectable()
/** The consumer door of the @@event@@ event in the @@reactor@@ reactor: it dispatches one command and forwards the event id. */
export class @@Event@@Consumer implements EventConsumer<@@Event@@Event> {
    readonly event = @@Event@@Event

    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Delivery is at least once: the domain service the command reaches claims `eventId` in the inbox inside its own transaction. */
    async handle(delivery: EventDelivery<@@Event@@Event>): Promise<void> {
        await this.commandBus.execute(new @@Action@@Command({ request: { eventId: delivery.eventId, event: delivery.event } }))
    }
}
