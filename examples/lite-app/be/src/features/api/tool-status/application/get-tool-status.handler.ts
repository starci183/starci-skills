import { QueryHandler } from "@nestjs/cqrs"
import { LivenessService } from "@modules/domain/liveness"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { LivenessReport } from "@modules/domain/liveness"
import { GetToolStatusQuery } from "./get-tool-status.query"

@QueryHandler(GetToolStatusQuery)
/** Answers the tool's status query from process-local liveness without touching a dependency. */
export class GetToolStatusHandler extends ICQRSHandler<GetToolStatusQuery, LivenessReport> {
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
