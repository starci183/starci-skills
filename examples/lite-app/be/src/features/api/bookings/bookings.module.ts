import { Module } from "@nestjs/common"
import { BookingsHandler } from "./application/bookings.handler"

@Module({ providers: [BookingsHandler] })
/** The bookings feature: the handlers of its application. */
export class BookingsApiModule {}
