import { CommandRunner, Option, SubCommand } from "nest-commander"
import { DEFAULT_SEED_ENV, SeedRunnerService } from "@modules/platform/database"

/** The options of `cli seed run`. */
export interface SeedRunOptions {
    /** The stack environment whose `.starcistacks/<env>/seeds` run. */
    readonly env?: string
}

@SubCommand({
    name: "run",
    description: "Run every seed file of a stack environment on the connection it names",
})
/** `cli seed run [--env <name>]`: seeds every connection of the back end from `.starcistacks/<env>/seeds` and logs what it ran. */
export class RunSeedsCli extends CommandRunner {
    constructor(private readonly seeds: SeedRunnerService) {
        super()
    }

    /** `--env <name>`: the stack environment whose seeds run. */
    @Option({
        flags: "--env <name>",
        description: "The stack environment whose seeds run",
        defaultValue: DEFAULT_SEED_ENV,
    })
    parseEnv(value: string): string {
        return value
    }

    /** Reads the seed files of the environment, runs them on their connections and logs the report. */
    async run(_passed: Array<string>, options?: SeedRunOptions): Promise<void> {
        await this.seeds.run(options?.env)
    }
}
