import { Module } from "@nestjs/common"
import { BookingRemindersModule } from "@modules/domain/booking-reminders"
import { BookingReminderCli } from "./booking-reminder.cli"
import { TickCli } from "./subs/tick.cli"

@Module({ imports: [BookingRemindersModule], providers: [BookingReminderCli, TickCli] })
/** The reminder command group; every action delegates to the booking-reminders capability. */
export class BookingReminderModule {}
