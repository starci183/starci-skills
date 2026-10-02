import { CommandRunner, SubCommand } from "nest-commander"
import { MigrationRunnerService } from "@modules/platform/database"

@SubCommand({
    name: "run",
    description: "Apply the pending migrations of every connection",
})
/** `cli migrate run`: migrates every connection of the back end, in order, and logs what it applied. */
export class RunCli extends CommandRunner {
    constructor(private readonly migrations: MigrationRunnerService) {
        super()
    }

    /** Runs the migrations of every connection and logs the applied names. */
    async run(): Promise<void> {
        await this.migrations.run()
    }
}
