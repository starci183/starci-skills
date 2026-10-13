import { QueryHandler } from "@nestjs/cqrs"
import { BookingsService } from "@modules/domain/bookings"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { GetBookingStatusResult } from "./get-booking-status.contracts"
import { GetBookingStatusQuery } from "./get-booking-status.query"

@QueryHandler(GetBookingStatusQuery)
/** Answers the confirmation status of one booking of the authenticated principal through one domain-service call. */
export class GetBookingStatusHandler extends ICQRSHandler<GetBookingStatusQuery, GetBookingStatusResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly bookingsService: BookingsService,
    ) {
        super(logger)
    }

    protected override process(query: GetBookingStatusQuery): Promise<GetBookingStatusResult> {
        return this.bookingsService.bookingStatus(query.params.principal.id, query.params.request.id)
    }
}
