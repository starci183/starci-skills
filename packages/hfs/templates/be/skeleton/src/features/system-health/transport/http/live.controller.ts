import { Controller, Get } from "@nestjs/common"
import { HealthCheck, HealthCheckResult, HealthCheckService } from "@nestjs/terminus"

/** Liveness probe: answers `{ status, info, error, details }` from process-local state and never touches a dependency. */
@Controller("health")
export class LiveController {
    constructor(
        /** Terminus executor; it runs no indicator, so a dependency outage never restarts the process. */
        private readonly health: HealthCheckService,
    ) {}

    /** Reports the process alive while its event loop still answers requests. */
    @Get("live")
    @HealthCheck()
    live(): Promise<HealthCheckResult> {
        return this.health.check([])
    }
}
