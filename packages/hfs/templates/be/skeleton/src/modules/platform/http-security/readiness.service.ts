import { Injectable } from "@nestjs/common"
import { InjectDatabaseProbe } from "@modules/platform/database"
import type { DatabaseProbeService } from "@modules/platform/database"
import { InjectTimer } from "@modules/platform/retry"
import type { Timer } from "@modules/platform/retry"
import { HttpSecurityError, HttpSecurityErrorCode } from "./errors/http-security.error"
import type { ReadinessReport } from "./readiness.contracts"

const READINESS_TIMEOUT_MS = 1000

@Injectable()
/** Required-dependency readiness; liveness never calls this database probe. */
export class ReadinessService {
    constructor(
        @InjectDatabaseProbe() private readonly database: DatabaseProbeService,
        @InjectTimer() private readonly timer: Timer,
    ) {}

    /** Returns ready only when the required primary database answers within one second. */
    async probeRequired(): Promise<ReadinessReport> {
        let cancel: () => void = () => undefined
        try {
            await Promise.race([
                this.database.probe(),
                new Promise<never>((_resolve, reject) => {
                    cancel = this.timer.schedule(
                        () => reject(new Error("Required database readiness timed out")),
                        READINESS_TIMEOUT_MS,
                    )
                }),
            ])
        } catch (cause) {
            throw new HttpSecurityError({ code: HttpSecurityErrorCode.RequiredDependencyUnavailable, cause })
        } finally {
            cancel()
        }
        return { ok: true }
    }
}
