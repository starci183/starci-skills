import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { SqlText } from "@modules/platform/database"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { InjectTimer } from "@modules/platform/retry"
import type { Timer } from "@modules/platform/retry"
import { LivenessError, LivenessErrorCode } from "./errors/liveness.error"
import type { DatabaseReadyRow, JobStatsRow } from "./persistence/readiness.rows"
import { CHECK_READINESS_DATABASE, CHECK_READINESS_JOBS } from "./persistence/readiness.sql"
import type { ReadinessCheckName, ReadinessReport } from "./readiness.contracts"
import { LivenessLogEvent } from "./readiness.log-events"

/** How long one dependency probe may take before the check answers not-ready. */
const PROBE_TIMEOUT_MS = 3000

@Injectable()
/**
 * The readiness of this process: it answers ready only while every required dependency of the app answers its probe —
 * the primary database and the job ledger behind it. A probe that fails or stalls fails the check closed.
 */
export class ReadinessService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectLogger() private readonly logger: Logger,
        @InjectTimer() private readonly timer: Timer,
    ) {}

    /** The report of one probe; it throws LIVENESS_UNAVAILABLE when a required dependency did not answer. */
    async check(): Promise<ReadinessReport> {
        const probe = async (check: ReadinessCheckName, statement: SqlText): Promise<"ok"> => {
            let cancel: () => void = () => undefined
            try {
                const rows = await Promise.race([
                    this.entityManager.query<Array<DatabaseReadyRow | JobStatsRow>>(statement),
                    new Promise<never>((_resolve, reject) => {
                        cancel = this.timer.schedule(
                            () => reject(new LivenessError({ code: LivenessErrorCode.Unavailable, params: { check } })),
                            PROBE_TIMEOUT_MS,
                        )
                    }),
                ])
                const row = rows[0]
                const answered =
                    check === "database"
                        ? row !== undefined && "ready" in row && row.ready === 1
                        : row !== undefined && "stats" in row && row.stats !== null && typeof row.stats === "object"
                if (!answered) throw new LivenessError({ code: LivenessErrorCode.Unavailable, params: { check } })
            } catch (cause) {
                this.logger.error(LivenessLogEvent.CheckFailed, cause, { check })
                throw cause
            } finally {
                cancel()
            }
            return "ok"
        }

        try {
            const [database, jobs] = await Promise.all([
                probe("database", CHECK_READINESS_DATABASE),
                probe("jobs", CHECK_READINESS_JOBS),
            ])
            return { status: "ready", checks: { database, jobs } }
        } catch (cause) {
            throw new LivenessError({ code: LivenessErrorCode.Unavailable, cause })
        }
    }
}
