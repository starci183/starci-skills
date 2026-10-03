import { readFile } from "node:fs/promises"
import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import type { SqlText } from "./database.sql"
import { InjectPrimaryEntityManager } from "./primary.decorators"

const SEED_FILE = "supabase/seed.sql"

function assertSeedText(_text: string): asserts _text is SqlText {
    // The brand is compile-time only; this function's caller reads the tracked seed file verbatim.
}

const seedText = (text: string): SqlText => {
    assertSeedText(text)
    return text
}

@Injectable()
/** Executes the one tracked Supabase seed through the shared least-privilege EntityManager. */
export class SeedRunnerService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** Reads and executes the tracked seed when it contains at least one statement. */
    async run(): Promise<void> {
        const text = seedText(await readFile(SEED_FILE, "utf8"))
        if (text.trim() !== "") await this.entityManager.query(text)
    }
}
