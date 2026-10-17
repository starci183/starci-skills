import type { DynamicModule } from "@nestjs/common"
import { CliModule } from "@features/cli"
import { BookingRemindersModule } from "@modules/domain/booking-reminders"

/** Registers command groups and the reminder capability they consume. */
export const commandModules = (): Array<DynamicModule> => [
    BookingRemindersModule.register({ isGlobal: true }),
    CliModule.register({}),
]
