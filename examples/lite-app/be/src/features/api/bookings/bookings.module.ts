import { Module } from "@nestjs/common"
import { CreateBookingHandler } from "./application/create-booking.handler"
import { GetBookingStatusHandler } from "./application/get-booking-status.handler"

@Module({ providers: [GetBookingStatusHandler, CreateBookingHandler] })
/** The bookings feature: the handlers of its application. */
export class BookingsApiModule {}
