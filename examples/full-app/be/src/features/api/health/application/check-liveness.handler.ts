import { QueryHandler } from "@nestjs/cqrs"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { InjectProbeChecker } from "@modules/platform/probes"
import type { LivenessReport, ProbeCheckerService } from "@modules/platform/probes"
import { CheckLivenessQuery } from "./check-liveness.query"

@QueryHandler(CheckLivenessQuery)
/** Answers from process-local state so a dependency outage never causes a liveness restart. */
export class CheckLivenessHandler extends ICQRSHandler<CheckLivenessQuery, LivenessReport> {
    constructor(
        @InjectLogger() logger: Logger,
        @InjectProbeChecker() private readonly checker: ProbeCheckerService,
    ) {
        super(logger)
    }

    protected override process(): Promise<LivenessReport> {
        return this.checker.live()
    }
}
