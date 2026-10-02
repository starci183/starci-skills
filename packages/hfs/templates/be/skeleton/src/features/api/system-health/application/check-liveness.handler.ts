import { QueryHandler } from "@nestjs/cqrs"
import { LivenessService } from "@modules/domain/liveness"
import type { LivenessReport } from "@modules/domain/liveness"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { CheckLivenessQuery } from "./check-liveness.query"

@QueryHandler(CheckLivenessQuery)
/** Answers the liveness probe from the liveness service: no dependency is touched, so an outage never restarts the process. */
export class CheckLivenessHandler extends ICQRSHandler<CheckLivenessQuery, LivenessReport> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly liveness: LivenessService,
    ) {
        super(logger)
    }

    protected override process(): Promise<LivenessReport> {
        return this.liveness.check()
    }
}
