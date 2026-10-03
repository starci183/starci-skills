import { Module } from "@nestjs/common"
import { BookingsApiModule } from "../../bookings.module"
import { BookingsController } from "./bookings.controller"

@Module({ imports: [BookingsApiModule], controllers: [BookingsController] })
/** The HTTP transport of the bookings feature. */
export class BookingsHttpModule {}
