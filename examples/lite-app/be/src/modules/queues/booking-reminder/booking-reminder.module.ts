import { Module } from "@nestjs/common"
import { ConfigurableModuleClass } from "./booking-reminder.module-definition"
import { BookingReminderQueue } from "./booking-reminder.queue"

@Module({ providers: [BookingReminderQueue], exports: [BookingReminderQueue] })
/** The booking-reminder queue: its typed producer, imported by the domain module whose service enqueues. */
export class BookingReminderModule extends ConfigurableModuleClass {}
