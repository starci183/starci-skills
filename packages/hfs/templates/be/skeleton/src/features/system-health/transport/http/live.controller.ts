import { Controller, Get } from "@nestjs/common"
import type { QueryBus } from "@nestjs/cqrs"
import type { LivenessReport } from "@modules/domain/liveness"
import { InjectQueryBus } from "@modules/platform/cqrs"
import { CheckLivenessQuery } from "../../application/check-liveness.query"

@Controller("health")
/** Liveness probe: answers the liveness report from process-local state and never touches a dependency. */
export class LiveController {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Reports the process alive while its event loop still answers requests. */
    @Get("live")
    live(): Promise<LivenessReport> {
        return this.queryBus.execute(new CheckLivenessQuery({ request: {} }))
    }
}
