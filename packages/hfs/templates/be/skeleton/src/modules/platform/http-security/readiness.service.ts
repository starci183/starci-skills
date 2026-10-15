import { Injectable, ServiceUnavailableException } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"

const READINESS_TIMEOUT_MS = 1000

/** Required-dependency readiness; liveness never calls this database probe. */
@Injectable()
export class ReadinessService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** Returns ready only when the required primary database answers within one second. */
    async probeRequired(): Promise<{ readonly ok: true }> {
        let timer: ReturnType<typeof setTimeout> | undefined
        try {
            await Promise.race([
                // BEGIN and COMMIT reach the required database without reading or changing business data.
                this.entityManager.transaction(async () => undefined),
                new Promise<never>((_resolve, reject) => {
                    timer = setTimeout(
                        () => reject(new Error("Required database readiness timed out")),
                        READINESS_TIMEOUT_MS,
                    )
                }),
            ])
        } catch {
            throw new ServiceUnavailableException("Required database is unavailable")
        } finally {
            clearTimeout(timer)
        }
        return { ok: true }
    }
}
