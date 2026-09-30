import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import type { Probe } from "@modules/platform/probes"
import { InjectDatabaseManagers } from "./database-probe.tokens"
import { PING } from "./database.sql"

@Injectable()
/** The health probe of the database capability: every connection the app opened must answer a ping. */
export class DatabaseProbeService implements Probe {
    /** The name the health report lists this probe under. */
    readonly name = "database"

    constructor(@InjectDatabaseManagers() private readonly managers: ReadonlyArray<EntityManager>) {}

    /** Resolves when every connection answers, rejects with the driver failure when one does not. */
    async check(): Promise<void> {
        for (const manager of this.managers) {
            await manager.query(PING, [])
        }
    }
}
