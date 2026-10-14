import { CommandRunner, SubCommand } from "nest-commander"
import { BookingRemindersService } from "@modules/domain/booking-reminders"

@SubCommand({ name: "tick", description: "Enqueue one booking reminder catch-up pass" })
/** `cli booking-reminder tick`: the manual counterpart of the pg_cron job. */
export class TickCli extends CommandRunner {
    constructor(private readonly reminders: BookingRemindersService) {
        super()
    }

    /** Sends one tick through the domain capability and propagates its failure. */
    async run(): Promise<void> {
        await this.reminders.enqueueTick()
    }
}
