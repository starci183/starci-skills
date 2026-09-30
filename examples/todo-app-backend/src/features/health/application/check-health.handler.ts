import { QueryHandler } from "@nestjs/cqrs"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { InjectProbeChecker } from "@modules/platform/probes"
import type { ProbeChecker } from "@modules/platform/probes"
import type { CheckHealthResult } from "./check-health.contracts"
import { CheckHealthQuery } from "./check-health.query"

@QueryHandler(CheckHealthQuery)
/** Probes every dependency of the app; the refusal carries the state of each so an operator sees which one is down. */
export class CheckHealthHandler extends ICQRSHandler<CheckHealthQuery, CheckHealthResult> {
    constructor(
        @InjectLogger() logger: Logger,
        @InjectProbeChecker() private readonly checker: ProbeChecker,
    ) {
        super(logger)
    }

    protected override async process(): Promise<CheckHealthResult> {
        return this.checker.check()
    }
}
