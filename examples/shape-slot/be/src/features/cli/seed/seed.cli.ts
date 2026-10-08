import { Command, CommandRunner } from "nest-commander"
import { RunSeedsCli } from "./subs/run.cli"

@Command({
    name: "seed",
    description: "The seed data of every connection",
    subCommands: [RunSeedsCli],
})
/** `cli seed`: the seed group; its commands are the sub-commands (`cli seed run`). */
export class SeedCli extends CommandRunner {
    /** Without a sub-command the group shows its help. */
    run(): Promise<void> {
        return this.command.help()
    }
}
