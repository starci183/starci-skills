import { Command, CommandRunner } from "nest-commander"
import { RunCli } from "./subs/run.cli"

@Command({
    name: "migrate",
    description: "The schema of every connection",
    subCommands: [RunCli],
})
/** `cli migrate`: the migration group; its commands are the sub-commands (`cli migrate run`). */
export class MigrateCli extends CommandRunner {
    /** Without a sub-command the group shows its help. */
    async run(): Promise<void> {
        this.command.help()
    }
}
