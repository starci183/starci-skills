import { Module } from "@nestjs/common"
import { BookingRemindersModule } from "@modules/domain/booking-reminders"
import { BookingReminderCli } from "./booking-reminder.cli"
import { ConfigurableModuleClass } from "./booking-reminder.module-definition"
import { TickCli } from "./subs/tick.cli"

@Module({ imports: [BookingRemindersModule.register({})], providers: [BookingReminderCli, TickCli] })
/** The reminder command group; every action delegates to the booking-reminders capability. */
export class BookingReminderModule extends ConfigurableModuleClass {}
