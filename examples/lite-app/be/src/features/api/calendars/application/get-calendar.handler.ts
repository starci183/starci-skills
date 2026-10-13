import { QueryHandler } from "@nestjs/cqrs"
import { CalendarsService } from "@modules/domain/calendars"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { GetCalendarResult } from "./get-calendar.contracts"
import { GetCalendarQuery } from "./get-calendar.query"

@QueryHandler(GetCalendarQuery)
/** Answers one calendar row of the authenticated principal through one domain-service call. */
export class GetCalendarHandler extends ICQRSHandler<GetCalendarQuery, GetCalendarResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly calendarsService: CalendarsService,
    ) {
        super(logger)
    }

    protected override process(query: GetCalendarQuery): Promise<GetCalendarResult> {
        return this.calendarsService.calendars(query.params.principal.id, query.params.request.id)
    }
}
