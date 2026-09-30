import { QueryHandler } from "@nestjs/cqrs"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ok, refused } from "@modules/platform/primitives"
import { InjectProbeChecker, ProbesErrorCode } from "@modules/platform/probes"
import type { ProbeCheckerService } from "@modules/platform/probes"
import type { CheckHealthResult } from "./check-health.contracts"
import { CheckHealthQuery } from "./check-health.query"

@QueryHandler(CheckHealthQuery)
/** Probes every dependency of the app; the refusal carries the state of each so an operator sees which one is down. */
export class CheckHealthHandler extends ICQRSHandler<CheckHealthQuery, CheckHealthResult> {
    constructor(
        @InjectLogger() logger: Logger,
        @InjectProbeChecker() private readonly checker: ProbeCheckerService,
    ) {
        super(logger)
    }

    protected override async process(): Promise<CheckHealthResult> {
        const report = await this.checker.run()
        return report.healthy ? ok(report) : refused(ProbesErrorCode.DependencyUnavailable, report.checks)
    }
}
