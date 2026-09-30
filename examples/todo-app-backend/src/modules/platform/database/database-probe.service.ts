import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import type { Probe } from "@modules/platform/probes"
import { PING } from "./database.sql"
import { InjectPrimaryEntityManager } from "./primary.decorators"

/** Token of the database health probe; an app lists it in the health options of the capabilities it wants probed. */
export const DATABASE_PROBE: unique symbol = Symbol("platform.database.probe")

@Injectable()
/** The health probe of the database capability: the primary connection must answer a ping. */
export class DatabaseProbeService implements Probe {
    /** The name the health report lists this probe under. */
    readonly name = "database"

    constructor(@InjectPrimaryEntityManager() private readonly manager: EntityManager) {}

    /** Resolves when the connection answers, rejects with the driver failure when it does not. */
    async check(): Promise<void> {
        await this.manager.query(PING, [])
    }
}
