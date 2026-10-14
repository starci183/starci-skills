import { Controller, Get } from "@nestjs/common"
import type { QueryBus } from "@nestjs/cqrs"
import { Public, PublicReason } from "@modules/domain/identity"
import type { ReadinessReport } from "@modules/domain/liveness"
import { InjectQueryBus } from "@modules/platform/cqrs"
import { CheckReadinessQuery } from "../../application/check-readiness.query"

@Controller("health")
/** Readiness probe: answers ready only while the dependencies the app requires answer their probes. */
export class ReadyController {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Reports the process ready while every required dependency answers. */
    @Get("ready")
    @Public({ reason: PublicReason.Health })
    ready(): Promise<ReadinessReport> {
        return this.queryBus.execute(new CheckReadinessQuery({ request: {} }))
    }
}
