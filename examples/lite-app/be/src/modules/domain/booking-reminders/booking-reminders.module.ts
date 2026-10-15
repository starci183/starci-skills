import { Module } from "@nestjs/common"
import { ConfigurableModuleClass } from "./booking-reminders.module-definition"
import { BookingRemindersService } from "./booking-reminders.service"

@Module({ providers: [BookingRemindersService], exports: [BookingRemindersService] })
/** Enqueues reminder ticks over the app's shared least-privilege primary database connection. */
export class BookingRemindersModule extends ConfigurableModuleClass {}
