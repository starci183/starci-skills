import { CommandRunner, SubCommand } from "nest-commander"
import { MigrationRunnerService } from "@modules/platform/database"

@SubCommand({ name: "run", description: "Push the pending Supabase migrations" })
/** `cli migrate run`: delegates schema authority to the managed Supabase db:push script. */
export class RunCli extends CommandRunner {
    constructor(private readonly migrations: MigrationRunnerService) {
        super()
    }

    /** Runs the one managed migration wrapper and propagates its failure. */
    async run(): Promise<void> {
        await this.migrations.run()
    }
}
