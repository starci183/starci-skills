import { CommandRunner, SubCommand } from "nest-commander"
import { SeedRunnerService } from "@modules/platform/database"

@SubCommand({ name: "run", description: "Run the tracked Supabase seed through the application role" })
/** `cli seed run`: executes the one tracked seed through the shared least-privilege EntityManager. */
export class RunSeedsCli extends CommandRunner {
    constructor(private readonly seeds: SeedRunnerService) {
        super()
    }

    /** Executes the tracked seed when it contains at least one statement. */
    async run(): Promise<void> {
        await this.seeds.run()
    }
}
