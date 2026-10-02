import { Module } from "@nestjs/common"
import { BookingsModule } from "../../bookings.module"
import { BookingsController } from "./bookings.controller"

@Module({ imports: [BookingsModule], controllers: [BookingsController] })
/** The HTTP transport of the bookings feature. */
export class BookingsHttpModule {}
