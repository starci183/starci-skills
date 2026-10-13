import { CommandHandler } from "@nestjs/cqrs"
import { CalendarsService } from "@modules/domain/calendars"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { CreateCalendarCommand } from "./create-calendar.command"
import type { CreateCalendarResult } from "./create-calendar.contracts"

@CommandHandler(CreateCalendarCommand)
/** Creates one calendar row for the authenticated principal through one domain-service call. */
export class CreateCalendarHandler extends ICQRSHandler<CreateCalendarCommand, CreateCalendarResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly calendarsService: CalendarsService,
    ) {
        super(logger)
    }

    protected override process(command: CreateCalendarCommand): Promise<CreateCalendarResult> {
        return this.calendarsService.createCalendar(command.params.principal.id)
    }
}
