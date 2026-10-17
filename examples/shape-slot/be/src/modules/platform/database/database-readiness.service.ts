import { InjectDeadlineScheduler } from "@modules/platform/http"
import type { DeadlineScheduler } from "@modules/platform/http"
import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import type { DatabaseReadinessReport } from "./database-readiness.contracts"
import { sql } from "./database.sql"
import { DatabaseError, DatabaseErrorCode } from "./errors/database.error"
import { InjectPrimaryEntityManager } from "./primary.decorators"

const READINESS_TIMEOUT_MS = 1000

@Injectable()
/** Probes the required primary connection with a one-second response deadline; a failed probe closes readiness. */
export class DatabaseReadinessService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectDeadlineScheduler() private readonly deadlines: DeadlineScheduler,
    ) {}

    /** Reads a constant from the primary database; driver failures never expose connection details in the report. */
    async check(): Promise<DatabaseReadinessReport> {
        let cancel: (() => void) | undefined
        const deadline = new Promise<never>((_resolve, reject) => {
            cancel = this.deadlines.schedule(
                () =>
                    reject(
                        new DatabaseError({
                            code: DatabaseErrorCode.RequiredUnavailable,
                            params: { dependency: "primary" },
                        }),
                    ),
                READINESS_TIMEOUT_MS,
            )
        })
        try {
            await Promise.race([this.entityManager.query(sql`select 1`), deadline])
        } catch (error) {
            throw new DatabaseError({
                code: DatabaseErrorCode.RequiredUnavailable,
                params: { dependency: "primary" },
                cause: error,
            })
        } finally {
            cancel?.()
        }
        return { status: "ok", dependencies: { primary: "ok" } }
    }
}
