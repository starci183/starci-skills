import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { Inject@@Connection@@EntityManager } from "@modules/platform/database"
import { @@Name@@ProjectionEntity } from "./@@name@@.projection-entity"

@Injectable()
/** The @@name@@ read model: the only writer of its table; callers read it with `get*`. */
export class @@Name@@Projection {
    constructor(@Inject@@Connection@@EntityManager() private readonly entityManager: EntityManager) {}

    /** Recomputes one row from the source facts of its own context: an upsert by the natural key, so repeating it changes nothing. */
    async recompute@@Name@@(id: string): Promise<void> {
        await this.entityManager.upsert(@@Name@@ProjectionEntity, { id }, ["id"])
    }

    /** Reads one row; the caller never sees the table. */
    async get@@Name@@(id: string): Promise<{ readonly id: string } | null> {
        const row = await this.entityManager.findOne(@@Name@@ProjectionEntity, { where: { id } })
        return row ? { id: row.id } : null
    }
}
