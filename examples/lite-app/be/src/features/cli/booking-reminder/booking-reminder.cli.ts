import { Command, CommandRunner } from "nest-commander"
import { TickCli } from "./subs/tick.cli"

@Command({
    name: "booking-reminder",
    description: "The booking reminder queue",
    subCommands: [TickCli],
})
/** `cli booking-reminder`: manual dispatch of the app-owned reminder tick. */
export class BookingReminderCli extends CommandRunner {
    /** Without a sub-command the group shows its help. */
    run(): Promise<void> {
        return this.command.help()
    }
}
