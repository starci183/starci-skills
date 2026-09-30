import type { EntityManager } from "typeorm"
import type { HealthProbe } from "@modules/platform/health"
import { PING } from "./database.sql"

/** The health probe of the database capability: every connection the app opened must answer a ping. */
export class DatabaseHealth implements HealthProbe {
    /** The name the health report lists this probe under. */
    readonly name = "database"

    constructor(private readonly managers: ReadonlyArray<EntityManager>) {}

    /** Resolves when every connection answers, rejects with the driver failure when one does not. */
    async check(): Promise<void> {
        for (const manager of this.managers) {
            await manager.query(PING, [])
        }
    }
}
