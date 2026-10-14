import { Command, CommandRunner } from "nest-commander"
import { TickCli } from "./subs/tick.cli"

@Command({ name: "order-expiry", description: "Pending order expiry jobs", subCommands: [TickCli] })
/** The manual order expiry command group. */
export class OrderExpiryCli extends CommandRunner {
    /** Without a sub-command the group displays its help. */
    run(): Promise<void> {
        return this.command.help()
    }
}
