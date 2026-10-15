import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "./primary.decorators"

@Injectable()
/** Checks that the required primary database accepts and commits a transaction. */
export class DatabaseProbeService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** Reaches the database and fails when its transaction cannot complete. */
    async probe(): Promise<void> {
        await this.entityManager.transaction(() => Promise.resolve(undefined))
    }
}
