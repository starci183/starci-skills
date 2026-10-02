import type { EntityManager } from "typeorm"
import { UserXpProjectionEntity } from "./user-xp.projection-entity"

/** The user-xp read model: the only writer of its table. */
export class UserXpProjection {
    constructor(private readonly entityManager: EntityManager) {}

    /** Recomputes one user's xp from scratch (idempotent). */
    async recomputeUserXp(userId: string, total: number): Promise<void> {
        await this.entityManager.update(UserXpProjectionEntity, { userId }, { total })
    }

    /** Reads one user's xp. */
    async getUserXp(userId: string): Promise<number> {
        const rows = await this.entityManager.find(UserXpProjectionEntity, { where: { userId } })
        return rows[0]?.total ?? 0
    }
}
