import { Module } from "@nestjs/common"
import { BookingsApiModule } from "../../bookings.module"
import { ConfigurableModuleClass } from "./bookings-graphql.module-definition"
import { CreateBookingResolver } from "./create-booking.resolver"
import { GetBookingStatusResolver } from "./get-booking-status.resolver"

@Module({ imports: [BookingsApiModule.register({})], providers: [GetBookingStatusResolver, CreateBookingResolver] })
/** The GraphQL transport of the bookings feature. */
export class BookingsGraphqlModule extends ConfigurableModuleClass {}
