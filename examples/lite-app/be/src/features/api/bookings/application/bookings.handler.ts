import { CommandHandler } from "@nestjs/cqrs"
import { BookingsService } from "@modules/domain/bookings"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { BookingsResult } from "./bookings.contracts"
import { BookingsCommand } from "./bookings.command"

@CommandHandler(BookingsCommand)
/** Books a resource for the authenticated principal through one domain-service call; the booking enqueues its confirmation. */
export class BookingsHandler extends ICQRSHandler<BookingsCommand, BookingsResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly bookingsService: BookingsService,
    ) {
        super(logger)
    }

    protected override process(command: BookingsCommand): Promise<BookingsResult> {
        return this.bookingsService.createBooking(command.params.principal.id, command.params.request)
    }
}
