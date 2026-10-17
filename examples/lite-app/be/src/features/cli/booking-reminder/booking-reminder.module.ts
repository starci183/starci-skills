import { Module } from "@nestjs/common"
import { BookingReminderCli } from "./booking-reminder.cli"
import { ConfigurableModuleClass } from "./booking-reminder.module-definition"
import { TickCli } from "./subs/tick.cli"

@Module({ providers: [BookingReminderCli, TickCli] })
/** The reminder command group; every action delegates to the booking-reminders capability. */
export class BookingReminderCliModule extends ConfigurableModuleClass {}
