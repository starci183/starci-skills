import { Controller, Get } from "@nestjs/common"
import type { QueryBus } from "@nestjs/cqrs"
import { PublicReason, Public } from "@modules/domain/identity"
import { InjectQueryBus } from "@modules/platform/cqrs"
import { unwrapOutcome } from "@modules/platform/primitives"
import { ProbesError } from "@modules/platform/probes"
import { CheckHealthQuery } from "../../application/check-health.query"
import { toCheckHealthResponse } from "./check-health.mapper"
import type { CheckHealthResponse } from "./dto/check-health.response"

@Controller("health")
/** The probe door: 200 while every dependency answers, 503 naming the ones that do not. */
export class HealthController {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Probes the dependencies of the app. */
    @Get()
    @Public({ reason: PublicReason.Health })
    async checkHealth(): Promise<CheckHealthResponse> {
        const outcome = await this.queryBus.execute(new CheckHealthQuery({ request: {} }))
        return toCheckHealthResponse(unwrapOutcome(outcome, ProbesError))
    }
}
