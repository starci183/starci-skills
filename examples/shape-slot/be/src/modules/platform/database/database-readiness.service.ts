import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { withOperationDeadline } from "@modules/platform/http"
import type { DatabaseReadinessReport } from "./database-readiness.contracts"
import { sql } from "./database.sql"
import { DatabaseError, DatabaseErrorCode } from "./errors/database.error"
import { InjectPrimaryEntityManager } from "./primary.decorators"

const READINESS_TIMEOUT_MS = 1000

@Injectable()
/** Probes the required primary connection with a one-second response deadline; a failed probe closes readiness. */
export class DatabaseReadinessService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** Reads a constant from the primary database; driver failures never expose connection details in the report. */
    async check(): Promise<DatabaseReadinessReport> {
        try {
            await withOperationDeadline(this.entityManager.query(sql`select 1`), READINESS_TIMEOUT_MS)
            return { status: "ok", dependencies: { primary: "ok" } }
        } catch (error) {
            throw new DatabaseError({
                code: DatabaseErrorCode.RequiredUnavailable,
                params: { dependency: "primary" },
                cause: error,
            })
        }
    }
}
