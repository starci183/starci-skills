import { Module } from "@nestjs/common"
import { ConfigurableModuleClass } from "./booking-confirmation.module-definition"
import { BookingConfirmationQueue } from "./booking-confirmation.queue"

@Module({ providers: [BookingConfirmationQueue], exports: [BookingConfirmationQueue] })
/** The booking-confirmation queue: its typed producer, imported by the domain module whose service enqueues. */
export class BookingConfirmationModule extends ConfigurableModuleClass {}
