import { Controller, Get } from "@nestjs/common"
import type { QueryBus } from "@nestjs/cqrs"
import { Public, PublicReason } from "@modules/domain/identity"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { DatabaseReadinessReport } from "@modules/platform/database"
import { CheckReadinessQuery } from "../../application/check-readiness.query"

@Controller("health")
/** Readiness door: answers 503 through the app error filter when its required database is unavailable. */
export class ReadyController {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Probes the primary database before accepting traffic. */
    @Get("ready")
    @Public({ reason: PublicReason.Health })
    ready(): Promise<DatabaseReadinessReport> {
        return this.queryBus.execute(new CheckReadinessQuery({ request: {} }))
    }
}
