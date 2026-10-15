import { Controller, Get } from "@nestjs/common"
import type { QueryBus } from "@nestjs/cqrs"
import { Public, PublicReason } from "@modules/domain/identity"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { ReadinessReport } from "@modules/platform/http-security"
import { CheckReadinessQuery } from "../../application/check-readiness.query"

@Controller("health")
/** Readiness door: reports the bounded required-dependency probe, independently of process liveness. */
export class ReadyController {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Answers 503 while the required primary database cannot serve the app. */
    @Get("ready")
    @Public({ reason: PublicReason.Health })
    ready(): Promise<ReadinessReport> {
        return this.queryBus.execute(new CheckReadinessQuery({ request: {} }))
    }
}
