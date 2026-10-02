import { readFile } from "node:fs/promises"
import { CommandRunner, SubCommand } from "nest-commander"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { SqlText } from "@modules/platform/database"

const SEED_FILE = "supabase/seed.sql"

/** Brands the tracked, reviewed seed file; no runtime value is interpolated into it. */
const seedText = (text: string): SqlText => text as SqlText

@SubCommand({ name: "run", description: "Run the tracked Supabase seed through the application role" })
/** `cli seed run`: executes the one tracked seed through the shared least-privilege EntityManager. */
export class RunSeedsCli extends CommandRunner {
    constructor(@InjectPrimaryEntityManager() private readonly manager: EntityManager) {
        super()
    }

    async run(): Promise<void> {
        const text = seedText(await readFile(SEED_FILE, "utf8"))
        if (text.trim() !== "") await this.manager.query(text)
    }
}
