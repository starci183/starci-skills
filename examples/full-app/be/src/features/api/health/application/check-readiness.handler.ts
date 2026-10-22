import { QueryHandler } from "@nestjs/cqrs"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { InjectReadiness } from "@modules/platform/probes"
import type { ReadinessReport, ReadinessService } from "@modules/platform/probes"
import { CheckReadinessQuery } from "./check-readiness.query"

@QueryHandler(CheckReadinessQuery)
/** Requires bounded dependency probes before reporting the state of all app dependencies. */
export class CheckReadinessHandler extends ICQRSHandler<CheckReadinessQuery, ReadinessReport> {
    constructor(
        @InjectLogger() logger: Logger,
        @InjectReadiness() private readonly readiness: ReadinessService,
    ) {
        super(logger)
    }

    protected override process(): Promise<ReadinessReport> {
        return this.readiness.probeRequired()
    }
}
