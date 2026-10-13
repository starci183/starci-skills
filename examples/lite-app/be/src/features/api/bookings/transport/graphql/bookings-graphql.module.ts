import { Module } from "@nestjs/common"
import { BookingsApiModule } from "../../bookings.module"
import { CreateBookingResolver } from "./create-booking.resolver"
import { GetBookingStatusResolver } from "./get-booking-status.resolver"

@Module({ imports: [BookingsApiModule], providers: [GetBookingStatusResolver, CreateBookingResolver] })
/** The GraphQL transport of the bookings feature. */
export class BookingsGraphqlModule {}
