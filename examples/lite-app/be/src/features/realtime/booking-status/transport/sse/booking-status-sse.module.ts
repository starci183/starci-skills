import { Module } from "@nestjs/common"
import { ConfigurableModuleClass } from "./booking-status-sse.module-definition"
import { BookingStatusController } from "./booking-status.controller"

@Module({ controllers: [BookingStatusController] })
/** The server-sent-events transport of the booking-status channel: one authenticated stream per owner. */
export class BookingStatusSseModule extends ConfigurableModuleClass {}
