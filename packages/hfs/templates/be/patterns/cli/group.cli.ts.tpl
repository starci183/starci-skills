import { Command, CommandRunner } from "nest-commander"
import { RunCli } from "./subs/run.cli"

@Command({ name: "@@group@@", description: "The @@group@@ commands", subCommands: [RunCli] })
/** `cli @@group@@`: the @@group@@ group; its commands are the sub-commands (`cli @@group@@ run`). */
export class @@Group@@Cli extends CommandRunner {
    /** Without a sub-command the group shows its help. */
    async run(): Promise<void> {
        this.command.help()
    }
}
