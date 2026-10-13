import { CommandHandler } from "@nestjs/cqrs"
import { BookingsService } from "@modules/domain/bookings"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { CreateBookingCommand } from "./create-booking.command"
import type { CreateBookingResult } from "./create-booking.contracts"

@CommandHandler(CreateBookingCommand)
/** Books a resource for the authenticated principal through one domain-service call; the booking enqueues its confirmation. */
export class CreateBookingHandler extends ICQRSHandler<CreateBookingCommand, CreateBookingResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly bookingsService: BookingsService,
    ) {
        super(logger)
    }

    protected override process(command: CreateBookingCommand): Promise<CreateBookingResult> {
        return this.bookingsService.createBooking(command.params.principal.id, command.params.request)
    }
}
